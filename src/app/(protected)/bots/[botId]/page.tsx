"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { JsonViewer } from "@/components/json-viewer";
import { format } from "date-fns";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TaskStatus {
  name: string;
  metaKey: string;
  completed: boolean;
  timestamp: string | null;
}

interface BotDetail {
  bot: Record<string, unknown>;
  transcription: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  participants: Array<Record<string, unknown>>;
  failedTasks: Array<Record<string, unknown>>;
  tasks: TaskStatus[];
}

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();
  const [data, setData] = useState<BotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [recoveringTasks, setRecoveringTasks] = useState(false);

  // Task result sheet state
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<unknown>(null);
  const [taskResultLoading, setTaskResultLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/bots/${botId}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [botId]);

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const res = await fetch(
        `/api/proxy/debugger/trigger_meeting_done/${botId}`,
        { method: "POST" }
      );
      const result = await res.json();
      if (res.ok) {
        toast.success(`Reprocessing triggered: ${result.processing_route}`);
      } else {
        toast.error(result.detail || "Failed to trigger reprocessing");
      }
    } catch {
      toast.error("Failed to trigger reprocessing");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleRunMissingTasks() {
    setRecoveringTasks(true);
    try {
      const res = await fetch(`/api/proxy/admin/bots/${botId}/run-missing-tasks`, {
        method: "POST",
      });
      const result = await res.json();
      if (res.ok) {
        if (result.status === "all_completed") {
          toast.success("All tasks already completed — nothing to run");
        } else {
          toast.success(
            `Dispatched ${result.total_missing} missing task(s): ${result.missing_tasks.join(", ")}`
          );
        }
      } else {
        toast.error(result.detail || "Failed to run missing tasks");
      }
    } catch {
      toast.error("Failed to run missing tasks");
    } finally {
      setRecoveringTasks(false);
    }
  }

  async function handleTaskClick(taskName: string) {
    setSelectedTask(taskName);
    setTaskResult(null);
    setSheetOpen(true);
    setTaskResultLoading(true);
    try {
      const res = await fetch(`/api/bots/${botId}/tasks/${taskName}/result`);
      const json = await res.json();
      if (res.ok) {
        setTaskResult(json.result);
      } else {
        setTaskResult({ error: json.detail || "Failed to load result" });
      }
    } catch {
      setTaskResult({ error: "Failed to load result" });
    } finally {
      setTaskResultLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!data?.bot) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Bot not found
      </div>
    );
  }

  const bot = data.bot;
  const completedTasks = data.tasks.filter((t) => t.completed).length;
  const totalTasks = data.tasks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/bots">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {botId}
          </h1>
          <p className="text-muted-foreground">
            {bot.org_name as string} &middot;{" "}
            {bot.deal_name ? (
              <Link
                href={`/deals?search=${bot.deal_id}`}
                className="text-blue-500 hover:underline"
              >
                {bot.deal_name as string}
              </Link>
            ) : (
              "No deal"
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleRunMissingTasks}
          disabled={recoveringTasks || reprocessing}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {recoveringTasks ? "Running..." : "Run Missing Tasks"}
        </Button>
        <Button onClick={handleReprocess} disabled={reprocessing || recoveringTasks}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {reprocessing ? "Triggering..." : "Reprocess All"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            {bot.in_meeting ? (
              <Badge variant="default">Active</Badge>
            ) : bot.recording_processed ? (
              <Badge variant="secondary">Processed</Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tasks Completed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {completedTasks}/{totalTasks}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Category</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{(bot.category as string) || "Unknown"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Created</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {format(new Date(bot.created_at as string), "MMM d, yyyy HH:mm")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post-Processing Tasks</CardTitle>
          <CardDescription>
            {completedTasks} of {totalTasks} tasks completed &middot; click any task to view its result
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {data.tasks.map((task) => (
              <button
                key={task.name}
                onClick={() => handleTaskClick(task.name)}
                className="flex items-center gap-2 rounded-md border p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {task.completed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-sm">{task.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.failedTasks.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Failed Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.failedTasks.map((ft, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">
                      {ft.task as string}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-destructive">
                      {ft.error as string}
                    </TableCell>
                    <TableCell className="text-xs">
                      {ft.created_at
                        ? format(new Date(ft.created_at as string), "MMM d, HH:mm")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Bot Details</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonViewer data={bot} className="max-h-96" />
        </CardContent>
      </Card>

      {/* Task Result Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedTask}</SheetTitle>
            <SheetDescription>
              Task result for bot <span className="font-mono">{botId}</span>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {taskResultLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading result...
              </div>
            ) : taskResult === null || taskResult === undefined ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No data found for this task yet.
              </div>
            ) : (
              <JsonViewer data={taskResult} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
