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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Play, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ScriptParam {
  name: string;
  label: string;
  type: "string" | "number" | "boolean";
  default?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
}

interface ScriptDef {
  id: string;
  name: string;
  file: string;
  description: string;
  params: ScriptParam[];
}

const SCRIPTS: ScriptDef[] = [
  {
    id: "match_deals_to_crm",
    name: "Match Deals to CRM",
    file: "match_deals_to_crm.py",
    description: "Batch-match internal deals to CRM opportunities using LLM matching",
    params: [
      { name: "org_id", label: "Org ID", type: "string", required: true, placeholder: "heysam" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
      { name: "use_embedding", label: "Use Embedding", type: "boolean", default: false },
      { name: "force", label: "Force", type: "boolean", default: false },
      { name: "limit", label: "Limit", type: "number", placeholder: "10" },
    ],
  },
  {
    id: "sync_external_deals",
    name: "Sync External Deals",
    file: "sync_external_deals.py",
    description: "Sync deals from CRM integrations into external_deal",
    params: [
      { name: "org_id", label: "Org ID", type: "string", required: true, placeholder: "heysam" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
      { name: "limit", label: "Limit", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "sync_external_companies",
    name: "Sync External Companies",
    file: "sync_external_companies.py",
    description: "Sync companies from CRM integrations into external_company",
    params: [
      { name: "org_id", label: "Org ID", type: "string", required: true, placeholder: "heysam" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
      { name: "limit", label: "Limit", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "populate_meeting_assets",
    name: "Populate Meeting Assets & Topics",
    file: "populate_meeting_assets_and_topics.py",
    description: "Populate meeting_topics and create missing meeting_assets for bots",
    params: [
      { name: "org_id", label: "Org ID", type: "string", required: true, placeholder: "heysam" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
      { name: "limit", label: "Limit", type: "number", placeholder: "10" },
    ],
  },
  {
    id: "create_missing_meeting_assets",
    name: "Create Missing Meeting Assets",
    file: "create_missing_meeting_assets.py",
    description: "Find bots without meeting_asset and run full processing",
    params: [
      { name: "org_id", label: "Org ID", type: "string", placeholder: "heysam" },
      { name: "days", label: "Days Back", type: "number", default: 7 },
      { name: "limit", label: "Limit", type: "number", placeholder: "10" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
    ],
  },
  {
    id: "check_upcoming_bots",
    name: "Check Upcoming Bots",
    file: "check_upcoming_bots.py",
    description: "List running bots and bots scheduled in the next N hours",
    params: [
      { name: "hours", label: "Hours Ahead", type: "number", default: 24 },
    ],
  },
  {
    id: "sync_external_deal_stages",
    name: "Sync External Deal Stages",
    file: "sync_external_deal_stages.py",
    description: "Sync deal stages from CRM integrations",
    params: [
      { name: "org_id", label: "Org ID", type: "string", required: true, placeholder: "heysam" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
    ],
  },
  {
    id: "auto_close_stuck_meetings",
    name: "Auto Close Stuck Meetings",
    file: "auto_close_stuck_meetings.py",
    description: "Close bots still in_meeting after N hours and optionally trigger post-processing",
    params: [
      { name: "hours_threshold", label: "Hours Threshold", type: "number", default: 24 },
      { name: "org_id", label: "Org ID (optional)", type: "string", placeholder: "heysam" },
      { name: "limit", label: "Limit", type: "number", placeholder: "50" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
      { name: "skip_processing", label: "Skip Post-Processing", type: "boolean", default: false },
    ],
  },
  {
    id: "sync_deal_stage",
    name: "Sync Deal Stage",
    file: "sync_deal_stage.py",
    description: "Sync a deal's stage from external_deal_stage (by deal_id or deal name + org)",
    params: [
      { name: "deal_id", label: "Deal ID", type: "string", placeholder: "uuid..." },
      { name: "deal_name", label: "Deal Name", type: "string", placeholder: "Acme Corp" },
      { name: "org_id", label: "Org ID", type: "string", placeholder: "heysam" },
      { name: "dry_run", label: "Dry Run", type: "boolean", default: true },
    ],
  },
];

export default function ScriptsPage() {
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string | boolean>>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("");
  const [outputScript, setOutputScript] = useState<string>("");

  // Bot task recovery state
  const [recoveryBotId, setRecoveryBotId] = useState("");
  const [runningRecovery, setRunningRecovery] = useState(false);
  const [recoveryOutput, setRecoveryOutput] = useState<string>("");

  function getParamValue(scriptId: string, paramName: string, defaultVal?: string | number | boolean) {
    return paramValues[scriptId]?.[paramName] ?? defaultVal ?? "";
  }

  function setParamValue(scriptId: string, paramName: string, value: string | boolean) {
    setParamValues((prev) => ({
      ...prev,
      [scriptId]: { ...prev[scriptId], [paramName]: value },
    }));
  }

  async function handleRun(script: ScriptDef) {
    setRunning(script.id);
    setOutput("");
    setOutputScript(script.name);

    const args: Record<string, unknown> = {};
    for (const param of script.params) {
      const val = getParamValue(script.id, param.name, param.default);
      if (val !== "" && val !== undefined) {
        args[param.name] = val;
      }
    }

    try {
      const res = await fetch("/api/proxy/admin/scripts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.file, args }),
      });

      const data = await res.json();
      if (res.ok) {
        setOutput(data.output || "Script completed with no output");
        toast.success(`${script.name} completed`);
      } else {
        setOutput(data.error || "Script failed");
        toast.error(`${script.name} failed`);
      }
    } catch {
      setOutput("Failed to run script");
      toast.error("Failed to run script");
    } finally {
      setRunning(null);
    }
  }

  async function handleRunMissingTasks() {
    const botId = recoveryBotId.trim();
    if (!botId) {
      toast.error("Enter a bot ID");
      return;
    }
    setRunningRecovery(true);
    setRecoveryOutput("");
    try {
      const res = await fetch(`/api/proxy/admin/bots/${botId}/run-missing-tasks`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "all_completed") {
          setRecoveryOutput(
            `✅ All tasks already completed for bot ${botId}\n\nCompleted tasks (${data.completed_tasks.length}):\n${data.completed_tasks.join("\n")}`
          );
          toast.success("All tasks already completed");
        } else {
          setRecoveryOutput(
            `🚀 Dispatched ${data.total_missing} missing task(s) for bot ${botId}\nWorkflow ID: ${data.workflow_id}\n\nMissing tasks dispatched:\n${data.missing_tasks.join("\n")}\n\nAlready completed (${data.completed_tasks.length}):\n${data.completed_tasks.join("\n")}`
          );
          toast.success(`Dispatched ${data.total_missing} missing task(s)`);
        }
      } else {
        setRecoveryOutput(`❌ Error: ${data.detail || JSON.stringify(data)}`);
        toast.error(data.detail || "Failed to run missing tasks");
      }
    } catch (e) {
      setRecoveryOutput(`❌ Request failed: ${e}`);
      toast.error("Failed to run missing tasks");
    } finally {
      setRunningRecovery(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Script Runner</h1>
        <p className="text-muted-foreground">
          Run common debug and sync scripts from the UI
        </p>
      </div>

      {/* Bot Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Bot Actions</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCcw className="h-4 w-4" />
                  Run Missing Tasks
                </CardTitle>
                <CardDescription className="mt-1">
                  Identify and immediately dispatch all incomplete post-processing tasks for a bot, in dependency order
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                POST /admin/bots/&#123;bot_id&#125;/run-missing-tasks
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Bot ID</Label>
              <Input
                placeholder="e.g. 16b38ad7-89e6-522b-b819-b1fdbb14aed1"
                value={recoveryBotId}
                onChange={(e) => setRecoveryBotId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunMissingTasks()}
                className="h-8 text-sm font-mono"
              />
            </div>
            <Button
              className="w-full mt-2"
              onClick={handleRunMissingTasks}
              disabled={runningRecovery}
            >
              {runningRecovery ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Missing Tasks
                </>
              )}
            </Button>
            {recoveryOutput && (
              <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap mt-2">
                {recoveryOutput}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scripts */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Scripts</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SCRIPTS.map((script) => (
          <Card key={script.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Terminal className="h-4 w-4" />
                    {script.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {script.description}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {script.file}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {script.params.map((param) => (
                <div key={param.name} className="space-y-1">
                  {param.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${script.id}-${param.name}`}
                        checked={
                          getParamValue(script.id, param.name, param.default) === true
                        }
                        onCheckedChange={(checked) =>
                          setParamValue(script.id, param.name, !!checked)
                        }
                      />
                      <Label htmlFor={`${script.id}-${param.name}`} className="text-sm">
                        {param.label}
                      </Label>
                    </div>
                  ) : (
                    <>
                      <Label className="text-xs">{param.label}</Label>
                      <Input
                        type={param.type === "number" ? "number" : "text"}
                        placeholder={param.placeholder}
                        value={getParamValue(script.id, param.name, param.default) as string}
                        onChange={(e) =>
                          setParamValue(script.id, param.name, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </>
                  )}
                </div>
              ))}
              <Button
                className="w-full mt-2"
                onClick={() => handleRun(script)}
                disabled={running === script.id}
              >
                {running === script.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Script
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {output && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Output: {outputScript}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <pre className="rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
                {output}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
