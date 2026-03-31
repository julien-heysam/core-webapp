"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio, ExternalLink } from "lucide-react";

interface Participant {
  name: string;
  email: string | null;
  employee: boolean | null;
}

interface TranscriptLine {
  speaker: string;
  text: string;
  start_time: number;
}

interface LiveBot {
  id: string;
  org_id: string;
  org_name: string | null;
  deal_id: string | null;
  deal_name: string | null;
  meeting_url: string | null;
  meeting_platform: string | null;
  join_at: string | null;
  duration_seconds: number | null;
  participants: Participant[];
  transcript: TranscriptLine[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function LiveDuration({ joinAt, initialSeconds }: { joinAt: string | null; initialSeconds: number | null }) {
  const [secs, setSecs] = useState(initialSeconds ?? 0);

  useEffect(() => {
    setSecs(initialSeconds ?? 0);
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [joinAt, initialSeconds]);

  return <span className="text-xs text-muted-foreground">{formatDuration(secs)}</span>;
}

function BotCard({ bot }: { bot: LiveBot }) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bot.transcript]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {bot.org_name || bot.org_id}
            </CardTitle>
            {bot.deal_name && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {bot.deal_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bot.meeting_platform && (
              <Badge variant="outline" className="text-xs">
                {bot.meeting_platform}
              </Badge>
            )}
            <LiveDuration joinAt={bot.join_at} initialSeconds={bot.duration_seconds} />
          </div>
        </div>

        {/* Participants */}
        {bot.participants.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {bot.participants.map((p) => (
              <Badge
                key={p.name}
                variant={p.employee ? "default" : "secondary"}
                className="text-xs"
              >
                {p.name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {bot.transcript.length > 0 ? (
          <ScrollArea className="h-52 rounded-md border bg-muted/30 p-2">
            {bot.transcript.map((line, i) => (
              <div key={i} className="mb-1 leading-snug">
                <span className="text-xs font-semibold text-foreground/70">
                  {line.speaker}:{" "}
                </span>
                <span className="text-xs font-mono text-foreground/90">{line.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </ScrollArea>
        ) : (
          <div className="h-52 rounded-md border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
            No transcript yet
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 pb-3">
        <Link
          href={`/bots/${bot.id}`}
          className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View full details
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function LivePage() {
  const [bots, setBots] = useState<LiveBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function fetchLive() {
    try {
      const res = await fetch("/api/proxy/admin/live");
      const data = await res.json();
      setBots(data.bots || []);
      setLastRefresh(new Date());
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Live Calls</h1>
            {!loading && (
              <Badge variant={bots.length > 0 ? "default" : "secondary"}>
                {bots.length} active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Bots currently in meetings · auto-refreshes every 30s
            {lastRefresh && (
              <> · last updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}</>
            )}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
          <Radio className="h-4 w-4 text-emerald-500" />
        </div>
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
          Loading...
        </div>
      )}

      {!loading && bots.length === 0 && (
        <Card className="flex h-52 items-center justify-center">
          <CardContent className="text-center text-muted-foreground">
            <Radio className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No active calls right now</p>
            <p className="text-xs mt-1">Bots in meetings will appear here automatically</p>
          </CardContent>
        </Card>
      )}

      {!loading && bots.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
