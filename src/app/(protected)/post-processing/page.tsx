"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, Copy, Search, ListTodo } from "lucide-react";

const ALL_TASKS = [
  "MeetingTranscription",
  "MeetingProductDetection",
  "MeetingParticipantTag",
  "MeetingCategorization",
  "DealDiscoveryQuestion",
  "DealKnowledgeExtraction",
  "DealKnowledgeDeduplication",
  "DealSpicedSummary",
  "DealBant",
  "DealMeddpicc",
  "DealMeddic",
  "MeetingGapExtraction",
  "MeetingQuestionExtraction",
  "MeetingQuoteExtraction",
  "MeetingPricingReference",
  "MeetingComplaint",
  "MeetingSourceCheck",
  "MeetingCompetitorExtraction",
  "MeetingSummary",
  "MeetingTopic",
  "MeetingSizzle",
  "MeetingSizzleSummary",
  "DealSummary",
  "MeetingFeedback",
  "MeetingIndexing",
  "MeetingAsset",
  "MeetingCrmUpdate",
  "MeetingEmailSummary",
  "MeetingSalesAnswer",
  "MeetingIntegrationEvents",
];

interface TaskStatus {
  name: string;
  completed: boolean;
  timestamp: string | null;
}

export default function PostProcessingPage() {
  const [botId, setBotId] = useState("");
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  async function handleLookup() {
    if (!botId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/admin/bots/${botId.trim()}`);
      if (!res.ok) {
        toast.error("Bot not found");
        setTasks([]);
        return;
      }
      const data = await res.json();
      setTasks(data.tasks || []);
      const incompleteNames = (data.tasks || [])
        .filter((t: TaskStatus) => !t.completed)
        .map((t: TaskStatus) => t.name);
      setSelectedTasks(new Set<string>(incompleteNames));
    } catch {
      toast.error("Failed to look up bot");
    } finally {
      setLoading(false);
    }
  }

  async function handleRerunAll() {
    setReprocessing(true);
    try {
      const res = await fetch(
        `/api/proxy/debugger/trigger_meeting_done/${botId.trim()}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Full reprocessing triggered via ${data.processing_route}`);
      } else {
        toast.error(data.detail || "Trigger failed");
      }
    } catch {
      toast.error("Failed to trigger reprocessing");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleRecoverMissing() {
    setReprocessing(true);
    try {
      const res = await fetch(
        `/api/proxy/admin/bots/${botId.trim()}/run-missing-tasks`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        if (data.status === "all_completed") {
          toast.success("All tasks already completed — nothing to run");
        } else {
          toast.success(
            `Dispatched ${data.total_missing} missing task(s): ${data.missing_tasks.join(", ")}`
          );
        }
      } else {
        toast.error(data.detail || "Recovery failed");
      }
    } catch {
      toast.error("Failed to trigger recovery");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleRerunSelected() {
    if (selectedTasks.size === 0) {
      toast.error("Select at least one task");
      return;
    }
    setReprocessing(true);
    try {
      const res = await fetch(
        `/api/proxy/admin/bots/${botId.trim()}/run-missing-tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_names: Array.from(selectedTasks),
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        if (data.status === "nothing_runnable") {
          toast.warning(
            data.skipped_tasks?.length
              ? `None of the selected tasks can be rerun via recovery (skipped: ${data.skipped_tasks.join(", ")}). Use full pipeline for transcription and other tasks.`
              : (data.message as string)
          );
        } else {
          const skipped =
            data.skipped_tasks?.length > 0
              ? ` (skipped — no worker: ${data.skipped_tasks.join(", ")})`
              : "";
          toast.success(
            `Dispatched ${data.total_dispatched ?? data.dispatched_tasks?.length ?? 0} task(s): ${(data.dispatched_tasks ?? []).join(", ")}${skipped}`
          );
        }
      } else {
        toast.error(data.detail || "Rerun failed");
      }
    } catch {
      toast.error("Failed to rerun selected tasks");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleCloneAndReprocess() {
    setReprocessing(true);
    try {
      const res = await fetch(
        `/api/proxy/debugger/clone_and_reprocess_bot/${botId.trim()}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Cloned to ${data.new_bot_id}`);
      } else {
        toast.error(data.detail || "Clone failed");
      }
    } catch {
      toast.error("Failed to clone and reprocess");
    } finally {
      setReprocessing(false);
    }
  }

  function setTaskSelected(name: string, checked: boolean) {
    const next = new Set(selectedTasks);
    if (checked) next.add(name);
    else next.delete(name);
    setSelectedTasks(next);
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Post-Processing</h1>
        <p className="text-muted-foreground">
          Inspect and rerun post-processing tasks for any bot
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Look up Bot</CardTitle>
          <CardDescription>
            Enter a bot ID to view its task completion status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Enter bot ID..."
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              className="font-mono flex-1"
            />
            <Button onClick={handleLookup} disabled={loading} className="sm:w-auto w-full">
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Looking up…" : "Look up"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {tasks.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>
                    Task Status ({completedCount}/{tasks.length})
                  </CardTitle>
                  <CardDescription>
                    Check tasks, then use &quot;Rerun selected tasks&quot; to redo them (including completed).
                    Use &quot;Recover missing tasks&quot; to auto-run only what is still incomplete.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedTasks(
                        new Set(tasks.filter((t) => !t.completed).map((t) => t.name))
                      )
                    }
                  >
                    Select incomplete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTasks(new Set(ALL_TASKS))}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTasks(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => (
                  <div
                    key={task.name}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <Checkbox
                      checked={selectedTasks.has(task.name)}
                      onCheckedChange={(checked) =>
                        setTaskSelected(task.name, checked === true)
                      }
                    />
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Label className="text-sm cursor-pointer flex-1">
                      {task.name}
                    </Label>
                    {task.completed && (
                      <Badge variant="secondary" className="text-[10px]">
                        Done
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Choose how to reprocess this bot
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                onClick={handleRerunAll}
                disabled={reprocessing}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Rerun Full Pipeline
              </Button>
              <Button
                variant="secondary"
                onClick={handleRerunSelected}
                disabled={reprocessing || selectedTasks.size === 0}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Rerun selected tasks
              </Button>
              <Button
                variant="outline"
                onClick={handleRecoverMissing}
                disabled={reprocessing}
              >
                <ListTodo className="mr-2 h-4 w-4" />
                Recover missing tasks
              </Button>
              <Button
                variant="outline"
                onClick={handleCloneAndReprocess}
                disabled={reprocessing}
              >
                <Copy className="mr-2 h-4 w-4" />
                Clone &amp; Reprocess
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
