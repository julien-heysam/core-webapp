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
import { RefreshCcw, Layers, Activity } from "lucide-react";

interface QueueInfo {
  name: string;
  depth: number;
}

interface QueueData {
  queues: QueueInfo[];
  connected: boolean;
  error?: string;
}

export default function QueuesPage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueues = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/admin/queues");
      const json = await res.json();
      setData(json);
    } catch {
      setData({ queues: [], connected: false, error: "Failed to fetch" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
    if (autoRefresh) {
      const interval = setInterval(fetchQueues, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchQueues, autoRefresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Queue Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Celery and Redis queue status
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="mr-2 h-4 w-4" />
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchQueues}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={data?.connected ? "default" : "destructive"}>
          {data?.connected ? "Connected" : "Disconnected"}
        </Badge>
        {data?.error && (
          <span className="text-sm text-destructive">{data.error}</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(data?.queues || []).map((q) => (
          <Card key={q.name}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {q.name}
              </CardDescription>
              <CardTitle className="text-4xl">{q.depth}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {q.depth === 0
                  ? "Queue is empty"
                  : `${q.depth} task${q.depth > 1 ? "s" : ""} pending`}
              </p>
            </CardContent>
          </Card>
        ))}
        {loading && !data && (
          <Card>
            <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
              Loading...
            </CardContent>
          </Card>
        )}
        {data && data.queues.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
              No queue data available. Make sure Redis is running.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
