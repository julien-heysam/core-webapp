"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  RefreshCcw,
  Brain,
  Clock,
  DollarSign,
  Zap,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Loader2,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface LLMData {
  overview: Record<string, unknown>[];
  time_to_first_token: Record<string, unknown>[];
  totals_by_model: Record<string, unknown>[];
  by_agent: Record<string, unknown>[];
  time_range: { from: string; to: string; granularity: string };
}

const CHART_COLORS = [
  "#818cf8", // indigo-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f472b6", // pink-400
  "#38bdf8", // sky-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
  "#e879f9", // fuchsia-400
  "#4ade80", // green-400
];

function shortModel(name: string): string {
  if (!name || name === "unknown") return "unknown";
  const parts = name.split("/");
  return parts[parts.length - 1];
}

function formatMs(ms: number): string {
  if (ms < 1) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-md bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LLMMonitoringPage() {
  const [data, setData] = useState<LLMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState("168");
  const [granularity, setGranularity] = useState("hour");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/admin/monitoring/llm?hours=${hours}&granularity=${granularity}`
      );
      if (!res.ok) {
        setError(`API returned ${res.status}`);
        return;
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      }
      setData(json);
    } catch (e) {
      setError("Failed to fetch LLM metrics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hours, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = useMemo(() => {
    if (!data?.totals_by_model?.length)
      return { calls: 0, cost: 0, tokens: 0, avgLatency: 0, p95Latency: 0 };
    let calls = 0,
      cost = 0,
      tokens = 0,
      latencySum = 0,
      latencyCount = 0,
      maxP95 = 0;
    for (const row of data.totals_by_model) {
      const c = Number(row.count_count || row.count || 0);
      calls += c;
      cost += Number(row.totalCost_sum || row.totalCost || 0);
      tokens += Number(row.totalTokens_sum || row.totalTokens || 0);
      const avg = Number(row.latency_avg || row.avgLatency || 0);
      const p95 = Number(row.latency_p95 || row.p95Latency || 0);
      if (avg > 0) {
        latencySum += avg * c;
        latencyCount += c;
      }
      if (p95 > maxP95) maxP95 = p95;
    }
    return {
      calls,
      cost,
      tokens,
      avgLatency: latencyCount > 0 ? latencySum / latencyCount : 0,
      p95Latency: maxP95,
    };
  }, [data]);

  const modelRows = useMemo(() => {
    if (!data?.totals_by_model) return [];
    return data.totals_by_model
      .map((row: Record<string, unknown>) => ({
        model: String(row.providedModelName || row.model || "unknown"),
        shortModel: shortModel(
          String(row.providedModelName || row.model || "unknown")
        ),
        calls: Number(row.count_count || row.count || 0),
        cost: Number(row.totalCost_sum || row.totalCost || 0),
        tokens: Number(row.totalTokens_sum || row.totalTokens || 0),
        avgLatency: Number(row.latency_avg || row.avgLatency || 0),
        p95Latency: Number(row.latency_p95 || row.p95Latency || 0),
      }))
      .filter((r) => r.calls > 0)
      .sort((a, b) => b.calls - a.calls);
  }, [data]);

  const modelChartData = useMemo(() => {
    return modelRows.slice(0, 8).map((r) => ({
      name: r.shortModel,
      calls: r.calls,
      cost: r.cost,
    }));
  }, [modelRows]);

  const costByModel = useMemo(() => {
    return modelRows
      .filter((r) => r.cost > 0)
      .slice(0, 8)
      .map((r) => ({
        name: r.shortModel,
        value: r.cost,
      }));
  }, [modelRows]);

  const agentRows = useMemo(() => {
    if (!data?.by_agent) return [];
    return data.by_agent
      .map((row: Record<string, unknown>) => ({
        agent: String(row.traceName || row.name || "unknown"),
        calls: Number(row.count_count || row.count || 0),
        cost: Number(row.totalCost_sum || row.totalCost || 0),
      }))
      .filter((r) => r.calls > 0 && r.agent !== "unknown" && r.agent !== "null")
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 12);
  }, [data]);

  const ttftRows = useMemo(() => {
    if (!data?.time_to_first_token) return [];
    return data.time_to_first_token
      .map((row: Record<string, unknown>) => ({
        model: shortModel(
          String(row.providedModelName || row.model || "unknown")
        ),
        p50: Number(row.timeToFirstToken_p50 || row.p50 || 0),
        p95: Number(row.timeToFirstToken_p95 || row.p95 || 0),
      }))
      .filter((r) => r.p50 > 0 || r.p95 > 0);
  }, [data]);

  const timeLabel = useMemo(() => {
    const h = parseInt(hours);
    if (h <= 6) return "last 6 hours";
    if (h <= 24) return "last 24 hours";
    if (h <= 72) return "last 3 days";
    if (h <= 168) return "last 7 days";
    return "last 30 days";
  }, [hours]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            LLM Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Metrics from Langfuse &mdash; latency, tokens, cost, and model
            usage
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Last 6 hours</SelectItem>
              <SelectItem value="24">Last 24 hours</SelectItem>
              <SelectItem value="72">Last 3 days</SelectItem>
              <SelectItem value="168">Last 7 days</SelectItem>
              <SelectItem value="720">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check that LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, and
                LANGFUSE_SECRET_KEY are configured correctly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total LLM Calls"
          value={totals.calls.toLocaleString()}
          subtitle={`In the ${timeLabel}`}
          icon={Brain}
        />
        <StatCard
          title="Avg Latency"
          value={formatMs(totals.avgLatency)}
          subtitle={`p95: ${formatMs(totals.p95Latency)}`}
          icon={Clock}
        />
        <StatCard
          title="Total Cost"
          value={formatCost(totals.cost)}
          subtitle={
            totals.calls > 0
              ? `~${formatCost(totals.cost / totals.calls)} per call`
              : "No calls yet"
          }
          icon={DollarSign}
        />
        <StatCard
          title="Total Tokens"
          value={formatTokens(totals.tokens)}
          subtitle={
            totals.calls > 0
              ? `~${formatTokens(Math.round(totals.tokens / totals.calls))} per call`
              : "No calls yet"
          }
          icon={Zap}
        />
      </div>

      {/* Charts row: Calls by model + Cost distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Calls by Model
            </CardTitle>
            <CardDescription>
              Top models by number of LLM invocations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {modelChartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={modelChartData}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis
                      type="number"
                      fontSize={12}
                      tick={{ fill: "rgba(255,255,255,0.6)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={140}
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.7)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => [
                        (value ?? 0).toLocaleString(),
                        "Calls",
                      ]}
                      contentStyle={{
                        backgroundColor: "#1c1c2e",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="calls" radius={[0, 6, 6, 0]}>
                      {modelChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No model data available for this time range" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost Distribution
            </CardTitle>
            <CardDescription>
              Spend breakdown across models
            </CardDescription>
          </CardHeader>
          <CardContent>
            {costByModel.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costByModel}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent, x, y }) => (
                        <text
                          x={x}
                          y={y}
                          fill="rgba(255,255,255,0.8)"
                          fontSize={11}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {`${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        </text>
                      )}
                      labelLine={false}
                    >
                      {costByModel.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => [
                        formatCost(value ?? 0),
                        "Cost",
                      ]}
                      contentStyle={{
                        backgroundColor: "#1c1c2e",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No cost data available for this time range" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* TTFT chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Time to First Token (TTFT)
          </CardTitle>
          <CardDescription>
            p50 and p95 TTFT by model &mdash; lower is better
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ttftRows.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ttftRows}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <XAxis
                    type="number"
                    fontSize={12}
                    tickFormatter={(v) => formatMs(v)}
                    tick={{ fill: "rgba(255,255,255,0.6)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.15)" }}
                  />
                  <YAxis
                    dataKey="model"
                    type="category"
                    width={140}
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.7)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number | undefined, name?: string) => [
                      formatMs(value ?? 0),
                      name ?? "",
                    ]}
                    contentStyle={{
                      backgroundColor: "#1c1c2e",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
                        {value}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="p50"
                    name="p50"
                    fill="#34d399"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="p95"
                    name="p95"
                    fill="#fb923c"
                    radius={[0, 4, 4, 0]}
                    fillOpacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No TTFT data available — TTFT is only tracked for streaming LLM calls" />
          )}
        </CardContent>
      </Card>

      {/* Model breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Model</CardTitle>
          <CardDescription>
            Detailed metrics per LLM model in the {timeLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modelRows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                    <TableHead className="text-right">p95 Latency</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Cost/Call</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelRows.map((row, i) => (
                    <TableRow key={row.model}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span className="font-mono text-xs">
                            {row.shortModel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.calls.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMs(row.avgLatency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMs(row.p95Latency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTokens(row.tokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCost(row.cost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.calls > 0
                          ? formatCost(row.cost / row.calls)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="border-t-2 font-medium bg-muted/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {totals.calls.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMs(totals.avgLatency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMs(totals.p95Latency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTokens(totals.tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCost(totals.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {totals.calls > 0
                        ? formatCost(totals.cost / totals.calls)
                        : "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState message="No model performance data available for this time range" />
          )}
        </CardContent>
      </Card>

      {/* Top agents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Top Agents by Usage
          </CardTitle>
          <CardDescription>
            Which agent types generate the most LLM calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentRows.length > 0 ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agentRows}
                  margin={{ bottom: 60, left: 10, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <XAxis
                    dataKey="agent"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.7)" }}
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.15)" }}
                  />
                  <YAxis
                    fontSize={12}
                    tick={{ fill: "rgba(255,255,255,0.6)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.15)" }}
                  />
                  <Tooltip
                    formatter={(value: number | undefined, name?: string) => {
                      const v = value ?? 0;
                      const n = name ?? "";
                      if (n === "Cost") return [formatCost(v), n];
                      return [v.toLocaleString(), n];
                    }}
                    contentStyle={{
                      backgroundColor: "#1c1c2e",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Bar
                    dataKey="calls"
                    name="Calls"
                    radius={[4, 4, 0, 0]}
                  >
                    {agentRows.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No agent data available for this time range" />
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card className="bg-muted/30">
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <span className="text-sm text-muted-foreground mr-1">
            External dashboards:
          </span>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            asChild
          >
            <a
              href="https://us.cloud.langfuse.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Brain className="h-3 w-3 mr-1" />
              Langfuse
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            asChild
          >
            <a
              href="https://us5.datadoghq.com/dashboard/lists"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Datadog
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
