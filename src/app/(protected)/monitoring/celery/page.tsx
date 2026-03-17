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
  Layers,
  Users,
  AlertTriangle,
  Loader2,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface CeleryData {
  queue_depths: Record<string, number>;
  task_throughput: { timestamp: number; value: number }[];
  task_failures: { timestamp: number; value: number }[];
  cpu: { timestamp: number; value: number }[];
  memory: { timestamp: number; value: number }[];
  keys_configured?: boolean;
  workers: {
    active_count: number;
    workers: { name: string; active_tasks: number }[];
  };
  recent_failed_tasks: {
    task_id: string;
    task_name: string;
    exception: string;
    exception_type: string;
    queue: string;
    failed_at: string;
  }[];
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

const QUEUE_COLORS = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#38bdf8",
];

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

export default function CeleryMonitoringPage() {
  const [data, setData] = useState<CeleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("1");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/proxy/admin/monitoring/celery?hours=${hours}`
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
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const queueData = data?.queue_depths
    ? Object.entries(data.queue_depths).map(([name, depth]) => ({
        name: name.replace("_processing", "").replace("_", " "),
        fullName: name,
        depth,
      }))
    : [];

  const totalQueued = queueData.reduce((sum, q) => sum + q.depth, 0);

  const cpuMemChartData = useMemo(() => {
    const cpu = data?.cpu ?? [];
    const memory = data?.memory ?? [];
    if (cpu.length === 0 && memory.length === 0) return [];
    const tsSet = new Set([
      ...cpu.map((p) => p.timestamp),
      ...memory.map((p) => p.timestamp),
    ]);
    return [...tsSet]
      .sort((a, b) => a - b)
      .map((ts) => {
        const cpuPt = cpu.find((p) => p.timestamp === ts);
        const memPt = memory.find((p) => p.timestamp === ts);
        return {
          timestamp: ts,
          cpu: cpuPt?.value ?? 0,
          memory: memPt?.value ?? 0,
        };
      });
  }, [data?.cpu, data?.memory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Celery Workers</h1>
          <p className="text-sm text-muted-foreground">
            Queue depths, task throughput, and worker status
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

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Workers
            </CardTitle>
            <div className="rounded-md bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {data?.workers?.active_count ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Queued
            </CardTitle>
            <div className="rounded-md bg-primary/10 p-2">
              <Layers className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold tracking-tight ${
                totalQueued > 50
                  ? "text-red-400"
                  : totalQueued > 20
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {totalQueued}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Failures
            </CardTitle>
            <div className="rounded-md bg-primary/10 p-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold tracking-tight ${
                (data?.recent_failed_tasks?.length ?? 0) > 5
                  ? "text-red-400"
                  : "text-muted-foreground"
              }`}
            >
              {data?.recent_failed_tasks?.length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Celery CPU & Memory */}
      <Card>
        <CardHeader>
          <CardTitle>CPU & Memory Utilization</CardTitle>
          <CardDescription>
            Celery worker container resource usage over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cpuMemChartData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cpuMemChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID_STROKE}
                  />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
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
                  <Line
                    dataKey="cpu"
                    name="CPU %"
                    stroke="#818cf8"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    dataKey="memory"
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
                  ? "Configure DD_API_KEY and DD_APP_KEY to fetch Celery CPU/memory metrics."
                  : "No CPU/memory data — set DD_ECS_RESOURCE_KEY to match your ECS service ARN."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Queue depths bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Depths</CardTitle>
          <CardDescription>Current pending tasks per queue</CardDescription>
        </CardHeader>
        <CardContent>
          {queueData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="name"
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
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number | undefined) => [value ?? 0, "Pending"]}
                  />
                  <Bar dataKey="depth" radius={[4, 4, 0, 0]}>
                    {queueData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={QUEUE_COLORS[i % QUEUE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No queue data available — requires Redis connection" />
          )}
        </CardContent>
      </Card>

      {/* Task throughput & failures */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task Throughput</CardTitle>
            <CardDescription>Completed tasks per second</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.task_throughput?.length ?? 0) > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.task_throughput || []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={GRID_STROKE}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
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
                    <Line
                      dataKey="value"
                      name="Completed/s"
                      stroke="#34d399"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No throughput data — requires DogStatsD metrics" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Failures</CardTitle>
            <CardDescription>Failed tasks per second</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.task_failures?.length ?? 0) > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.task_failures || []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={GRID_STROKE}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
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
                    <Line
                      dataKey="value"
                      name="Failures/s"
                      stroke="#f87171"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No failure data — requires DogStatsD metrics" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workers table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Workers</CardTitle>
          <CardDescription>Celery worker instances and their current load</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.workers?.workers && data.workers.workers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker Name</TableHead>
                  <TableHead className="text-right">Active Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.workers.workers.map((w) => (
                  <TableRow key={w.name}>
                    <TableCell className="font-mono text-sm">
                      {w.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={w.active_tasks > 0 ? "default" : "secondary"}
                      >
                        {w.active_tasks}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState message="No active workers detected — start a Celery worker to see status" />
          )}
        </CardContent>
      </Card>

      {/* Recent failed tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Failed Tasks</CardTitle>
          <CardDescription>
            Last 20 task failures (stored in Redis for 1 week)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.recent_failed_tasks && data.recent_failed_tasks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Failed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_failed_tasks.slice(0, 20).map((t) => (
                    <TableRow key={t.task_id}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {t.task_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t.queue || "default"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate text-red-400">
                        {t.exception_type}: {t.exception?.slice(0, 100)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {t.failed_at
                          ? new Date(t.failed_at).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState message="No recent failures — all clear!" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
