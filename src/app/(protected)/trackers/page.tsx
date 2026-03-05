"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  SortableHeader,
  SortState,
  cycleSort,
  sortData,
} from "@/components/sortable-header";

interface Tracker {
  id: string;
  name: string;
  org_id: string;
  user_id: string;
  schedule: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  prompt_preview: string;
  filters: Record<string, unknown> | null;
  notification_channels: string[] | null;
  created_at: string;
  updated_at: string;
}

interface TrackerResult {
  id: string;
  tracker_id: string;
  status: string;
  execution_time: number | null;
  result_summary: string | null;
  /** Array of call objects from API; we display the count */
  calls_found: unknown[] | null;
  created_at: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absDiffMs = Math.abs(diffMs);

    if (absDiffMs < 60000) return diffMs > 0 ? "in < 1 min" : "< 1 min ago";
    if (absDiffMs < 3600000) {
      const mins = Math.round(absDiffMs / 60000);
      return diffMs > 0 ? `in ${mins}m` : `${mins}m ago`;
    }
    if (absDiffMs < 86400000) {
      const hours = Math.round(absDiffMs / 3600000);
      return diffMs > 0 ? `in ${hours}h` : `${hours}h ago`;
    }
    const days = Math.round(absDiffMs / 86400000);
    return diffMs > 0 ? `in ${days}d` : `${days}d ago`;
  } catch {
    return dateStr;
  }
}

export default function TrackersPage() {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
  const [results, setResults] = useState<TrackerResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const fetchTrackers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trackers");
      const data = await res.json();
      if (Array.isArray(data)) setTrackers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrackers();
  }, [fetchTrackers]);

  async function openResults(tracker: Tracker) {
    setSelectedTracker(tracker);
    setResultsLoading(true);
    try {
      const res = await fetch(`/api/trackers/${tracker.id}/results`);
      const data = await res.json();
      if (Array.isArray(data)) setResults(data);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
  }

  const sorted = sortData(trackers, sort);
  const activeCount = trackers.filter((t) => t.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduled Trackers</h1>
          <p className="text-muted-foreground">
            {trackers.length} trackers ({activeCount} active)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTrackers} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name" label="Name" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <SortableHeader column="org_id" label="Org" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <SortableHeader column="schedule" label="Schedule" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <SortableHeader column="is_active" label="Active" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <SortableHeader column="last_run_at" label="Last Run" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <SortableHeader column="next_run_at" label="Next Run" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <SortableHeader column="run_count" label="Run Count" sort={sort} onSort={(c) => setSort(cycleSort(sort, c))} />
                <TableHead>Prompt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading trackers...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No trackers found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((tracker) => (
                  <TableRow
                    key={tracker.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openResults(tracker)}
                  >
                    <TableCell className="font-medium">{tracker.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {tracker.org_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {tracker.schedule}
                      </code>
                    </TableCell>
                    <TableCell>
                      {tracker.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" title={formatDate(tracker.last_run_at)}>
                      {formatRelativeTime(tracker.last_run_at)}
                    </TableCell>
                    <TableCell className="text-xs" title={formatDate(tracker.next_run_at)}>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatRelativeTime(tracker.next_run_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{tracker.run_count ?? 0}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {tracker.prompt_preview}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTracker} onOpenChange={(open) => !open && setSelectedTracker(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedTracker?.name}</DialogTitle>
            <DialogDescription>
              {selectedTracker?.org_id} &middot; {selectedTracker?.schedule} &middot;{" "}
              {selectedTracker?.is_active ? "Active" : "Inactive"}
            </DialogDescription>
          </DialogHeader>

          {selectedTracker && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Prompt Preview</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedTracker.prompt_preview}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Recent Results</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {resultsLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading results...</p>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No results yet</p>
                  ) : (
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Calls Found</TableHead>
                            <TableHead>Exec Time</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Summary</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>
                                {r.status === "success" ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : r.status === "failed" ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                {Array.isArray(r.calls_found)
                                  ? r.calls_found.length
                                  : r.calls_found != null && typeof r.calls_found === "object"
                                    ? 1
                                    : "—"}
                              </TableCell>
                              <TableCell>
                                {r.execution_time != null && !Number.isNaN(Number(r.execution_time))
                                  ? `${Number(r.execution_time).toFixed(1)}s`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                              <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                                {r.result_summary || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
