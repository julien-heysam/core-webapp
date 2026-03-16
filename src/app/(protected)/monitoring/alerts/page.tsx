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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCcw,
  ExternalLink,
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ShieldCheck,
  Brain,
  BarChart3,
} from "lucide-react";

interface Monitor {
  id: number;
  name: string;
  type: string;
  status: string;
  query: string;
  message: string;
  tags: string[];
  created: string;
  modified: string;
}

interface AlertData {
  monitors: Monitor[];
  links: {
    datadog_dashboard: string;
    datadog_monitors: string;
    langfuse: string;
  };
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "OK":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          OK
        </Badge>
      );
    case "Alert":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
          <XCircle className="mr-1 h-3 w-3" />
          Alert
        </Badge>
      );
    case "Warn":
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Warn
        </Badge>
      );
    case "No Data":
      return (
        <Badge variant="secondary">
          No Data
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/admin/monitoring/alerts");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const okCount =
    data?.monitors?.filter((m) => m.status === "OK").length ?? 0;
  const alertCount =
    data?.monitors?.filter((m) => m.status === "Alert").length ?? 0;
  const warnCount =
    data?.monitors?.filter((m) => m.status === "Warn").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Alerts & Monitors
          </h1>
          <p className="text-sm text-muted-foreground">
            Datadog monitor status and alert configuration
          </p>
        </div>
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

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Healthy
            </CardTitle>
            <div className="rounded-md bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-emerald-400">
              {okCount}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Warning
            </CardTitle>
            <div className="rounded-md bg-amber-500/10 p-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-amber-400">
              {warnCount}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alerting
            </CardTitle>
            <div className="rounded-md bg-red-500/10 p-2">
              <XCircle className="h-4 w-4 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-red-400">
              {alertCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitors table */}
      <Card>
        <CardHeader>
          <CardTitle>Datadog Monitors</CardTitle>
          <CardDescription>
            All monitors tagged with service:heysam-core
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.monitors && data.monitors.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Last Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.monitors.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {m.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.tags
                            ?.filter((t) => t.startsWith("severity:"))
                            .map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="text-xs"
                              >
                                {t}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {m.modified
                          ? new Date(m.modified).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              message={
                loading
                  ? "Loading monitors..."
                  : "No monitors found. Configure DD_API_KEY and DD_APP_KEY to see Datadog monitors."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Alert configuration reference */}
      <Card>
        <CardHeader>
          <CardTitle>Monitor Thresholds</CardTitle>
          <CardDescription>
            Configured alert thresholds (from monitors.json)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Warning</TableHead>
                  <TableHead className="text-right">Critical</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  {
                    name: "High CPU",
                    metric: "aws.ecs.cpu_utilization",
                    warn: "70%",
                    crit: "80%",
                  },
                  {
                    name: "High Memory",
                    metric: "aws.ecs.memory_utilization",
                    warn: "75%",
                    crit: "85%",
                  },
                  {
                    name: "HTTP Error Rate",
                    metric: "heysam.http.request.error",
                    warn: "2%",
                    crit: "5%",
                  },
                  {
                    name: "Request Latency (p95)",
                    metric: "heysam.http.request.duration",
                    warn: "3s",
                    crit: "5s",
                  },
                  {
                    name: "Celery Queue Buildup",
                    metric: "heysam.celery.queue.depth",
                    warn: "25",
                    crit: "50",
                  },
                  {
                    name: "Celery Task Failures",
                    metric: "heysam.celery.task.failed",
                    warn: "5",
                    crit: "10",
                  },
                  {
                    name: "LLM Latency (p95)",
                    metric: "heysam.llm.call.duration",
                    warn: "10s",
                    crit: "15s",
                  },
                  {
                    name: "LLM Error Spike",
                    metric: "heysam.llm.call.error",
                    warn: "3",
                    crit: "5",
                  },
                ].map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.metric}
                    </TableCell>
                    <TableCell className="text-right text-amber-400 font-medium">
                      {row.warn}
                    </TableCell>
                    <TableCell className="text-right text-red-400 font-medium">
                      {row.crit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">External Dashboards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors py-2 px-3"
              asChild
            >
              <a
                href={
                  data?.links?.datadog_monitors ||
                  "https://us5.datadoghq.com/monitors/manage"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                Datadog Monitors
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors py-2 px-3"
              asChild
            >
              <a
                href={
                  data?.links?.datadog_dashboard ||
                  "https://us5.datadoghq.com/dashboard/lists"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Datadog Dashboard
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors py-2 px-3"
              asChild
            >
              <a
                href={
                  data?.links?.langfuse || "https://us.cloud.langfuse.com"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Langfuse
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
