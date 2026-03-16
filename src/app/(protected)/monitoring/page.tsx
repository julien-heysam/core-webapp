"use client";

import { useEffect, useState, useCallback } from "react";
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
  RefreshCcw,
  Cpu,
  HardDrive,
  Activity,
  AlertTriangle,
  ExternalLink,
  Loader2,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface InfraData {
  cpu: MetricPoint[];
  memory: MetricPoint[];
  request_rate: MetricPoint[];
  error_rate: MetricPoint[];
  error?: string;
  keys_configured?: boolean;
  dd_error?: string;
  service_tag?: string;
  ecs_metric_filter?: string;
  dd_api_key_set?: boolean;
  dd_app_key_set?: boolean;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1c1c2e",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e2e8f0",
};

const AXIS_TICK = { fill: "rgba(255,255,255,0.6)", fontSize: 12 };
const AXIS_LINE = { stroke: "rgba(255,255,255,0.15)" };
const GRID_STROKE = "rgba(255,255,255,0.1)";

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  status,
}: {
  title: string;
  value: string;
  unit: string;
  icon: React.ElementType;
  status: "ok" | "warning" | "critical";
}) {
  const colors = {
    ok: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  };
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
        <div className={`text-3xl font-bold tracking-tight ${colors[status]}`}>
          {value}
          <span className="text-sm font-normal text-muted-foreground ml-1">
            {unit}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitoringPage() {
  const [data, setData] = useState<InfraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("1");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/proxy/admin/monitoring/infrastructure?hours=${hours}`
      );
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const latestCpu =
    data?.cpu?.length ? data.cpu[data.cpu.length - 1].value : 0;
  const latestMem =
    data?.memory?.length ? data.memory[data.memory.length - 1].value : 0;
  const latestReqRate =
    data?.request_rate?.length
      ? data.request_rate[data.request_rate.length - 1].value
      : 0;
  const latestErrRate =
    data?.error_rate?.length
      ? data.error_rate[data.error_rate.length - 1].value
      : 0;

  function cpuStatus(v: number): "ok" | "warning" | "critical" {
    if (v >= 80) return "critical";
    if (v >= 60) return "warning";
    return "ok";
  }

  function memStatus(v: number): "ok" | "warning" | "critical" {
    if (v >= 85) return "critical";
    if (v >= 70) return "warning";
    return "ok";
  }

  const hasCpuMemData = (data?.cpu?.length ?? 0) > 0 || (data?.memory?.length ?? 0) > 0;
  const hasReqData = (data?.request_rate?.length ?? 0) > 0 || (data?.error_rate?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Infrastructure Monitoring
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time server health from Datadog
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 1 hour</SelectItem>
              <SelectItem value="6">Last 6 hours</SelectItem>
              <SelectItem value="24">Last 24 hours</SelectItem>
              <SelectItem value="72">Last 3 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Pause" : "Resume"}
          </Button>
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

      {data?.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {data.error}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {!data?.keys_configured
                  ? `Add DD_API_KEY and DD_APP_KEY to project root .env. Restart FastAPI. (API key: ${data?.dd_api_key_set ? "✓" : "✗"}, App key: ${data?.dd_app_key_set ? "✓" : "✗"})`
                  : data.ecs_metric_filter
                    ? `CPU/memory query uses ${data.ecs_metric_filter}. Set ECS_SERVICE_NAME if your ECS service name differs.`
                    : "Check Datadog API keys and that AWS integration has ECS enabled."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU Usage"
          value={latestCpu.toFixed(1)}
          unit="%"
          icon={Cpu}
          status={cpuStatus(latestCpu)}
        />
        <MetricCard
          title="Memory Usage"
          value={latestMem.toFixed(1)}
          unit="%"
          icon={HardDrive}
          status={memStatus(latestMem)}
        />
        <MetricCard
          title="Request Rate"
          value={latestReqRate.toFixed(1)}
          unit="req/s"
          icon={Activity}
          status="ok"
        />
        <MetricCard
          title="Error Rate"
          value={latestErrRate.toFixed(2)}
          unit="err/s"
          icon={AlertTriangle}
          status={
            latestErrRate > 1
              ? "critical"
              : latestErrRate > 0.1
              ? "warning"
              : "ok"
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CPU & Memory Utilization</CardTitle>
            <CardDescription>
              ECS container resource usage over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasCpuMemData ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      allowDuplicatedCategory={false}
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={AXIS_LINE}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={AXIS_LINE}
                    />
                    <Tooltip
                      labelFormatter={(v) => formatTime(v as number)}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
                          {value}
                        </span>
                      )}
                    />
                    <Line
                      data={data?.cpu || []}
                      dataKey="value"
                      name="CPU %"
                      stroke="#818cf8"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      data={data?.memory || []}
                      dataKey="value"
                      name="Memory %"
                      stroke="#34d399"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                message={
                  !data?.keys_configured
                    ? "Configure DD_API_KEY and DD_APP_KEY to fetch CPU/memory metrics."
                    : data?.dd_error
                      ? data.dd_error
                      : `No CPU/memory data for ${data?.ecs_metric_filter || data?.service_tag || "service"}. ` +
                        "AWS ECS metrics use ecs_service_name. Set ECS_SERVICE_NAME to match your ECS service name. " +
                        "Ensure AWS integration has ECS enabled in Datadog."
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request & Error Rate</CardTitle>
            <CardDescription>
              HTTP traffic and 5xx errors per second
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasReqData ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      allowDuplicatedCategory={false}
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={AXIS_LINE}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={AXIS_LINE}
                    />
                    <Tooltip
                      labelFormatter={(v) => formatTime(v as number)}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
                          {value}
                        </span>
                      )}
                    />
                    <Line
                      data={data?.request_rate || []}
                      dataKey="value"
                      name="Requests/s"
                      stroke="#38bdf8"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      data={data?.error_rate || []}
                      dataKey="value"
                      name="Errors/s"
                      stroke="#f87171"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                message={
                  !data?.keys_configured
                    ? "Configure DD_API_KEY and DD_APP_KEY to fetch request metrics."
                    : data?.dd_error
                      ? data.dd_error
                      : "No request data — ensure DogStatsD metrics (heysam.http.request.*) are being emitted to the Datadog agent."
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

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
              href="https://us5.datadoghq.com/dashboard/lists"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datadog Dashboard
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            asChild
          >
            <a
              href="https://us5.datadoghq.com/apm/traces"
              target="_blank"
              rel="noopener noreferrer"
            >
              APM Traces
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            asChild
          >
            <a
              href="https://us5.datadoghq.com/logs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Logs Explorer
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
