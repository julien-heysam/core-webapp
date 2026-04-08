"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  RefreshCcw,
  XCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TelemetryRow {
  id: string;
  trace_id: string;
  org_id: string | null;
  bot_id: string | null;
  deal_id: string | null;
  trigger_text: string | null;
  trigger_speaker: string | null;
  trigger_start_time: number | null;
  trigger_end_time: number | null;
  webhook_received_at: number | null;
  celery_enqueued_at: number | null;
  celery_started_at: number | null;
  webhook_processing_ms: number | null;
  queue_wait_ms: number | null;
  setup_ms: number | null;
  context_build_ms: number | null;
  llm_call_ms: number | null;
  ably_publish_ms: number | null;
  total_e2e_ms: number | null;
  spoken_to_published_ms: number | null;
  context_source: string | null;
  question_text: string | null;
  status: string | null;
  error_message: string | null;
  llm_model: string | null;
  retry_count: number | null;
  created_at: string | null;
}

interface StageStats {
  p50?: number;
  p95?: number;
  p99?: number;
  mean?: number;
  max?: number;
}

interface PipelineStats {
  count: number;
  success_count?: number;
  error_count?: number;
  idk_count?: number;
  error_rate_pct?: number;
  redis_hit_rate_pct?: number;
  e2e?: StageStats;
  queue_wait?: StageStats;
  llm_call?: StageStats;
  ably_publish?: StageStats;
  setup?: StageStats;
  context_build?: StageStats;
  webhook_processing?: StageStats;
}

interface TimelinePoint {
  timestamp: number;
  count: number;
  avg_e2e_ms: number;
  avg_queue_wait_ms: number;
  avg_llm_call_ms: number;
  avg_ably_publish_ms: number;
  avg_setup_ms: number;
  avg_context_build_ms: number;
  avg_webhook_processing_ms: number;
}

interface PipelineData {
  rows: TelemetryRow[];
  stats: PipelineStats;
  timeline: TimelinePoint[];
  filters: Record<string, unknown>;
}

// ─── Chart constants ──────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#1c1c2e",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e2e8f0",
};
const AXIS_TICK = { fill: "rgba(255,255,255,0.6)", fontSize: 11 };
const AXIS_LINE = { stroke: "rgba(255,255,255,0.15)" };
const GRID_STROKE = "rgba(255,255,255,0.08)";

const STAGE_COLORS: Record<string, string> = {
  avg_webhook_processing_ms: "#94a3b8",
  avg_queue_wait_ms: "#f87171",
  avg_setup_ms: "#fb923c",
  avg_context_build_ms: "#fbbf24",
  avg_llm_call_ms: "#818cf8",
  avg_ably_publish_ms: "#34d399",
};

const STAGE_LABELS: Record<string, string> = {
  avg_webhook_processing_ms: "Webhook",
  avg_queue_wait_ms: "Queue Wait",
  avg_setup_ms: "Setup",
  avg_context_build_ms: "Context Build",
  avg_llm_call_ms: "LLM Call",
  avg_ably_publish_ms: "Ably Publish",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ms(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 60000) return `${(val / 60000).toFixed(1)}m`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}s`;
  return `${Math.round(val)}ms`;
}

function latencyColor(val: number | null | undefined): string {
  if (val == null) return "text-muted-foreground";
  if (val < 5000) return "text-emerald-400";
  if (val < 15000) return "text-amber-400";
  return "text-red-400";
}

function statusBadge(status: string | null) {
  switch (status) {
    case "success":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          success
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          error
        </Badge>
      );
    case "idk":
      return (
        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
          idk
        </Badge>
      );
    case "skipped":
      return (
        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
          skipped
        </Badge>
      );
    default:
      return <Badge variant="outline">{status ?? "—"}</Badge>;
  }
}

function formatTs(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  colorClass?: string;
}) {
  return (
    <Card className="bg-card/60 border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <p className={`text-2xl font-bold ${colorClass ?? ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveQuestionPipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("24");
  const [botIdFilter, setBotIdFilter] = useState("");
  const [orgIdFilter, setOrgIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slowOnly, setSlowOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TelemetryRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ hours, limit: "100" });
      if (botIdFilter) params.set("bot_id", botIdFilter);
      if (orgIdFilter) params.set("org_id", orgIdFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (slowOnly) params.set("slow_only", "true");

      const res = await fetch(`/api/proxy/admin/live-question-pipeline?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hours, botIdFilter, orgIdFilter, statusFilter, slowOnly]);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const timelineChartData = useMemo(
    () =>
      (data?.timeline ?? []).map((pt) => ({
        ...pt,
        label: new Date(pt.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [data]
  );

  const stats = data?.stats;
  const rows = data?.rows ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-indigo-400" />
            Live Question Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end latency telemetry for live question extraction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card/60 border-border/50">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Time range</label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Bot ID</label>
              <Input
                className="h-8 w-52 text-xs"
                placeholder="Filter by bot_id…"
                value={botIdFilter}
                onChange={(e) => setBotIdFilter(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Org ID</label>
              <Input
                className="h-8 w-52 text-xs"
                placeholder="Filter by org_id…"
                value={orgIdFilter}
                onChange={(e) => setOrgIdFilter(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="idk">IDK</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Slow only</label>
              <Button
                variant={slowOnly ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setSlowOnly((v) => !v)}
              >
                {slowOnly ? "≥10s" : "All speeds"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !data && (
        <Card className="bg-card/60 border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Failed to load telemetry data.</p>
          </CardContent>
        </Card>
      )}

      {!loading && data && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total extractions"
              value={String(stats?.count ?? 0)}
              sub={`last ${hours}h`}
              icon={Gauge}
            />
            <StatCard
              title="Median E2E"
              value={ms(stats?.e2e?.p50)}
              sub={`p95: ${ms(stats?.e2e?.p95)}`}
              icon={Clock}
              colorClass={latencyColor(stats?.e2e?.p50)}
            />
            <StatCard
              title="P95 E2E"
              value={ms(stats?.e2e?.p95)}
              sub={`p99: ${ms(stats?.e2e?.p99)}`}
              icon={Clock}
              colorClass={latencyColor(stats?.e2e?.p95)}
            />
            <StatCard
              title="Error rate"
              value={`${stats?.error_rate_pct ?? 0}%`}
              sub={`${stats?.error_count ?? 0} errors / ${stats?.count ?? 0} total`}
              icon={AlertTriangle}
              colorClass={
                (stats?.error_rate_pct ?? 0) > 5
                  ? "text-red-400"
                  : "text-emerald-400"
              }
            />
          </div>

          {/* Stage stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { key: "queue_wait", label: "Queue Wait", color: "text-red-400" },
              { key: "llm_call", label: "LLM Call", color: "text-indigo-400" },
              {
                key: "context_build",
                label: "Context Build",
                color: "text-amber-400",
              },
              { key: "setup", label: "Setup", color: "text-orange-400" },
              {
                key: "ably_publish",
                label: "Ably Publish",
                color: "text-emerald-400",
              },
              {
                key: "webhook_processing",
                label: "Webhook",
                color: "text-slate-400",
              },
            ].map(({ key, label, color }) => {
              const s = stats?.[key as keyof PipelineStats] as
                | StageStats
                | undefined;
              return (
                <Card key={key} className="bg-card/40 border-border/40">
                  <CardContent className="pt-3 pb-2">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-lg font-semibold ${color}`}>
                      {ms(s?.p50)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      p95: {ms(s?.p95)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Redis hit rate */}
          {stats?.redis_hit_rate_pct != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Redis hit rate:</span>
              <span
                className={
                  stats.redis_hit_rate_pct > 80
                    ? "text-emerald-400 font-medium"
                    : "text-amber-400 font-medium"
                }
              >
                {stats.redis_hit_rate_pct}%
              </span>
              <span className="text-xs">
                ({stats.redis_hit_rate_pct < 80
                  ? "⚠ DB fallback is common — may add significant latency"
                  : "✓ good"})
              </span>
            </div>
          )}

          {/* Timeline chart */}
          {timelineChartData.length > 0 && (
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Latency Timeline</CardTitle>
                <CardDescription>
                  Stacked average latency per stage (5-min buckets)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={timelineChartData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={GRID_STROKE}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                      tickFormatter={(v) => ms(v)}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => [
                        ms(v),
                        STAGE_LABELS[name] ?? name,
                      ]}
                    />
                    <Legend
                      formatter={(v) => STAGE_LABELS[v] ?? v}
                      wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                    />
                    {Object.entries(STAGE_COLORS).map(([key, color]) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stackId="1"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.6}
                        strokeWidth={1}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Breakdown table */}
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Recent Extractions
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({rows.length} rows)
                </span>
              </CardTitle>
              <CardDescription>
                Click a row to see full details. Trace IDs are searchable in
                Datadog.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Trace ID</TableHead>
                      <TableHead className="text-xs">Bot</TableHead>
                      <TableHead className="text-xs">Trigger</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">
                        Webhook
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        Queue
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        Context
                      </TableHead>
                      <TableHead className="text-xs text-right">LLM</TableHead>
                      <TableHead className="text-xs text-right">Ably</TableHead>
                      <TableHead className="text-xs text-right font-semibold">
                        E2E
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={11}
                          className="text-center text-muted-foreground py-8"
                        >
                          No extractions found for the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-border/30 cursor-pointer hover:bg-muted/20"
                        onClick={() => setSelectedRow(row)}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTs(row.created_at)}
                        </TableCell>
                        <TableCell>
                          <code
                            className="text-xs bg-muted/30 px-1.5 py-0.5 rounded font-mono cursor-copy"
                            title="Click to copy"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(row.trace_id);
                            }}
                          >
                            {row.trace_id}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                          {row.bot_id ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate text-muted-foreground">
                          {row.trigger_text
                            ? `"${row.trigger_text.slice(0, 60)}${row.trigger_text.length > 60 ? "…" : ""}"`
                            : "—"}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell
                          className={`text-xs text-right ${latencyColor(row.webhook_processing_ms)}`}
                        >
                          {ms(row.webhook_processing_ms)}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right ${latencyColor(row.queue_wait_ms)}`}
                        >
                          {ms(row.queue_wait_ms)}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right ${latencyColor(row.context_build_ms)}`}
                        >
                          {ms(row.context_build_ms)}
                          {row.context_source === "db_fallback" && (
                            <span className="ml-1 text-amber-400" title="DB fallback">
                              ⚠
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right ${latencyColor(row.llm_call_ms)}`}
                        >
                          {ms(row.llm_call_ms)}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right ${latencyColor(row.ably_publish_ms)}`}
                        >
                          {ms(row.ably_publish_ms)}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right font-semibold ${latencyColor(row.total_e2e_ms)}`}
                        >
                          {ms(row.total_e2e_ms)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Row detail dialog */}
      <Dialog
        open={!!selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-indigo-400" />
              Extraction Detail
            </DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4 text-sm">
              {/* Trace + status */}
              <div className="flex items-center gap-3">
                <code className="text-xs bg-muted/40 px-2 py-1 rounded font-mono">
                  {selectedRow.trace_id}
                </code>
                {statusBadge(selectedRow.status)}
                <span className="text-xs text-muted-foreground">
                  {formatTs(selectedRow.created_at)}
                </span>
              </div>

              {/* IDs */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Bot ID</p>
                  <p className="font-mono">{selectedRow.bot_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Org ID</p>
                  <p className="font-mono">{selectedRow.org_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Deal ID</p>
                  <p className="font-mono">{selectedRow.deal_id ?? "—"}</p>
                </div>
              </div>

              {/* Trigger transcript */}
              {selectedRow.trigger_text && (
                <div className="bg-muted/20 rounded p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Trigger transcript
                    {selectedRow.trigger_speaker && (
                      <span className="ml-2 text-amber-400">
                        — {selectedRow.trigger_speaker}
                      </span>
                    )}
                    {selectedRow.trigger_start_time != null && (
                      <span className="ml-2 text-slate-400">
                        @{selectedRow.trigger_start_time.toFixed(1)}s –{" "}
                        {selectedRow.trigger_end_time?.toFixed(1)}s
                      </span>
                    )}
                  </p>
                  <p className="text-sm italic">
                    &ldquo;{selectedRow.trigger_text}&rdquo;
                  </p>
                </div>
              )}

              {/* Extracted question */}
              {selectedRow.question_text && (
                <div className="bg-indigo-500/10 rounded p-3 border border-indigo-500/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    Extracted question
                  </p>
                  <p className="text-sm">{selectedRow.question_text}</p>
                </div>
              )}

              {/* Error */}
              {selectedRow.error_message && (
                <div className="bg-red-500/10 rounded p-3 border border-red-500/20">
                  <p className="text-xs text-red-400 mb-1">Error</p>
                  <p className="text-xs font-mono">{selectedRow.error_message}</p>
                </div>
              )}

              {/* Timing breakdown */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Timing breakdown
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      label: "Webhook processing",
                      val: selectedRow.webhook_processing_ms,
                    },
                    {
                      label: "Celery queue wait",
                      val: selectedRow.queue_wait_ms,
                    },
                    { label: "Task setup", val: selectedRow.setup_ms },
                    {
                      label: `Context build (${selectedRow.context_source ?? "?"})`,
                      val: selectedRow.context_build_ms,
                    },
                    { label: "LLM call", val: selectedRow.llm_call_ms },
                    { label: "Ably publish", val: selectedRow.ably_publish_ms },
                    {
                      label: "Total E2E",
                      val: selectedRow.total_e2e_ms,
                      bold: true,
                    },
                  ].map(({ label, val, bold }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span
                        className={`text-muted-foreground ${bold ? "font-semibold text-foreground" : ""}`}
                      >
                        {label}
                      </span>
                      <span
                        className={`font-mono ${latencyColor(val)} ${bold ? "font-semibold" : ""}`}
                      >
                        {ms(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">LLM model</p>
                  <p className="font-mono">{selectedRow.llm_model ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Retry count</p>
                  <p>{selectedRow.retry_count ?? 0}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t border-border/30 pt-3">
                Search{" "}
                <code className="bg-muted/40 px-1 rounded">
                  {selectedRow.trace_id}
                </code>{" "}
                in Datadog to see the full cross-service trace.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
