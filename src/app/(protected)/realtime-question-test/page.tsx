"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Ably from "ably";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Radio, Zap, Trash2, Clock, CheckCircle2, Loader2, WifiOff, BarChart2 } from "lucide-react";

interface QuestionEvent {
  id: string;
  text: string;
  latencyMs: number;
  triggeredAt: string;
  receivedAt: string;
  taskId: string;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface LatencyStats {
  count: number;
  min: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

function computeStats(latencies: number[]): LatencyStats | null {
  if (latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const pct = (p: number) => {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  };
  return {
    count: sorted.length,
    min: sorted[0],
    p50: pct(50),
    p75: pct(75),
    p95: pct(95),
    p99: pct(99),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

function latencyColor(ms: number): string {
  if (ms < 5000) return "text-green-500";
  if (ms < 15000) return "text-yellow-500";
  return "text-red-500";
}

function LatencyBadge({ ms }: { ms: number }) {
  if (ms < 5000) {
    return <Badge className="bg-green-500 hover:bg-green-600 text-white">{(ms / 1000).toFixed(2)}s</Badge>;
  }
  if (ms < 15000) {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">{(ms / 1000).toFixed(2)}s</Badge>;
  }
  return <Badge className="bg-red-500 hover:bg-red-600 text-white">{(ms / 1000).toFixed(2)}s</Badge>;
}

export default function RealtimeQuestionTestPage() {
  const [botId, setBotId] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [subscribedChannel, setSubscribedChannel] = useState<string | null>(null);
  const [events, setEvents] = useState<QuestionEvent[]>([]);
  const [pendingTriggers, setPendingTriggers] = useState<
    Map<string, { triggeredAt: string; taskId: string }>
  >(new Map());

  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const subscribedOrgRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      ablyRef.current?.close();
    };
  }, []);

  async function subscribeToOrg(orgId: string, botIdToFilter: string, triggeredAt: string, taskId: string) {
    const channelName = `${orgId}:in_meeting`;

    if (subscribedOrgRef.current === orgId && ablyRef.current) {
      setPendingTriggers((prev) => new Map(prev).set(taskId, { triggeredAt, taskId }));
      return;
    }

    channelRef.current?.unsubscribe();
    ablyRef.current?.close();
    ablyRef.current = null;
    channelRef.current = null;
    subscribedOrgRef.current = null;

    setConnectionStatus("connecting");
    setSubscribedChannel(channelName);

    try {
      const tokenRes = await fetch(`/api/ably-token?channel=${encodeURIComponent(channelName)}`);
      if (!tokenRes.ok) throw new Error("Failed to get Ably token");
      const tokenRequest = await tokenRes.json();

      const ably = new Ably.Realtime({ authCallback: (_data, callback) => callback(null, tokenRequest) });
      ablyRef.current = ably;

      ably.connection.on("connected", () => {
        setConnectionStatus("connected");
        subscribedOrgRef.current = orgId;
      });
      ably.connection.on("failed", () => setConnectionStatus("error"));
      ably.connection.on("disconnected", () => setConnectionStatus("error"));

      const channel = ably.channels.get(channelName);
      channelRef.current = channel;

      channel.subscribe("live_call", (message) => {
        const data = typeof message.data === "string" ? JSON.parse(message.data) : message.data;

        if (data.event !== "live_question_extraction") return;
        if (data.bot_id !== botIdToFilter) return;

        const now = Date.now();
        setPendingTriggers((prev) => {
          const updated = new Map(prev);
          let matchedTaskId = taskId;
          let matchedTriggeredAt = triggeredAt;

          if (updated.size > 0) {
            const entry = updated.entries().next().value as [string, { triggeredAt: string; taskId: string }] | undefined;
            if (entry) {
              matchedTaskId = entry[0];
              matchedTriggeredAt = entry[1].triggeredAt;
              updated.delete(entry[0]);
            }
          }

          const latencyMs = now - new Date(matchedTriggeredAt).getTime();

          setEvents((prev) => [
            {
              id: `${matchedTaskId}-${now}`,
              text: data.text,
              latencyMs,
              triggeredAt: matchedTriggeredAt,
              receivedAt: new Date(now).toISOString(),
              taskId: matchedTaskId,
            },
            ...prev,
          ]);

          return updated;
        });
      });

      setPendingTriggers((prev) => new Map(prev).set(taskId, { triggeredAt, taskId }));
    } catch (err) {
      setConnectionStatus("error");
      toast.error(`Ably connection failed: ${err}`);
    }
  }

  async function handleTrigger() {
    if (!botId.trim()) {
      toast.error("Enter a bot ID");
      return;
    }

    setTriggering(true);
    try {
      const res = await fetch("/api/proxy/admin/realtime-question-test/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Failed to trigger task");
        return;
      }

      toast.success(`Task dispatched: ${data.task_id}`);
      await subscribeToOrg(data.org_id, data.bot_id, data.triggered_at, data.task_id);
    } catch (err) {
      toast.error(`Request failed: ${err}`);
    } finally {
      setTriggering(false);
    }
  }

  function handleClear() {
    setEvents([]);
    setPendingTriggers(new Map());
  }

  function handleDisconnect() {
    channelRef.current?.unsubscribe();
    ablyRef.current?.close();
    ablyRef.current = null;
    channelRef.current = null;
    subscribedOrgRef.current = null;
    setConnectionStatus("idle");
    setSubscribedChannel(null);
    setPendingTriggers(new Map());
  }

  const pendingCount = pendingTriggers.size;
  const stats = useMemo(() => computeStats(events.map((e) => e.latencyMs)), [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Realtime Question Detection</h1>
        <p className="text-muted-foreground">
          Trigger live question extraction for a bot and watch results arrive via Ably
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trigger Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Trigger Extraction
            </CardTitle>
            <CardDescription>
              Enter a bot ID to dispatch a live question extraction Celery task
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot-id">Bot ID</Label>
              <Input
                id="bot-id"
                placeholder="e.g. bot_abc123..."
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrigger()}
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={handleTrigger} disabled={triggering || !botId.trim()} className="w-full">
              {triggering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Trigger Extraction
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Ably Connection
            </CardTitle>
            <CardDescription>Live channel subscription status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {connectionStatus === "idle" && (
                <>
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Not connected — trigger a task to connect</span>
                </>
              )}
              {connectionStatus === "connecting" && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-500">Connecting to Ably...</span>
                </>
              )}
              {connectionStatus === "connected" && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                </>
              )}
              {connectionStatus === "error" && (
                <>
                  <WifiOff className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-red-500">Connection error</span>
                </>
              )}
            </div>

            {subscribedChannel && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Channel</p>
                <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">{subscribedChannel}</code>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Questions received</span>
              <Badge variant="secondary">{events.length}</Badge>
            </div>

            {pendingCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Clock className="h-4 w-4" />
                <span>{pendingCount} task{pendingCount > 1 ? "s" : ""} waiting for response...</span>
              </div>
            )}

            {connectionStatus !== "idle" && (
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="w-full">
                <WifiOff className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latency Stats Panel */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              Latency Statistics
            </CardTitle>
            <CardDescription>
              Client-observed latency from trigger dispatch to Ably receipt — {stats.count} sample{stats.count !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {(
                [
                  { label: "Min", value: stats.min },
                  { label: "p50", value: stats.p50 },
                  { label: "p75", value: stats.p75 },
                  { label: "p95", value: stats.p95 },
                  { label: "p99", value: stats.p99 },
                  { label: "Max", value: stats.max },
                  { label: "Mean", value: stats.mean },
                  { label: "Count", value: null, raw: stats.count },
                ] as { label: string; value: number | null; raw?: number }[]
              ).map(({ label, value, raw }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-lg border bg-muted/40 px-2 py-3 gap-1"
                >
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                  {value !== null ? (
                    <span className={`text-lg font-bold tabular-nums ${latencyColor(value)}`}>
                      {(value / 1000).toFixed(2)}s
                    </span>
                  ) : (
                    <span className="text-lg font-bold tabular-nums">{raw}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Question Feed
            </CardTitle>
            <CardDescription>
              Extracted questions appear here in real time — latency is measured from trigger to receipt
            </CardDescription>
          </div>
          {events.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Radio className="h-8 w-8 opacity-30" />
              <p className="text-sm">No questions received yet</p>
              <p className="text-xs">Trigger an extraction above to start</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {events.map((event, idx) => (
                  <div key={event.id}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-snug flex-1">{event.text}</p>
                        <LatencyBadge ms={event.latencyMs} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                        <span>task: {event.taskId}</span>
                        <span>triggered: {new Date(event.triggeredAt).toLocaleTimeString()}</span>
                        <span>received: {new Date(event.receivedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
