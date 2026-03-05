"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonViewer } from "@/components/json-viewer";
import {
  Search,
  RefreshCcw,
  Trash2,
  Eye,
  Database,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface RedisKey {
  key: string;
  type: string;
  ttl: number;
}

interface KeysResponse {
  pattern: string | null;
  total: number;
  keys: RedisKey[];
}

interface KeyValue {
  key: string;
  type: string;
  ttl: number;
  value: unknown;
}

const TYPE_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  string: "default",
  list: "secondary",
  hash: "secondary",
  set: "outline",
  zset: "outline",
};

function formatTTL(ttl: number): string {
  if (ttl === -1) return "no expiry";
  if (ttl === -2) return "expired";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
  return `${Math.floor(ttl / 86400)}d`;
}

export default function RedisStoragePage() {
  const [pattern, setPattern] = useState("*");
  const [inputPattern, setInputPattern] = useState("*");
  const [limit, setLimit] = useState(200);
  const [data, setData] = useState<KeysResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<KeyValue | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchKeys = useCallback(async (pat: string, lim: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pattern: pat, limit: String(lim) });
      const res = await fetch(`/api/proxy/redis_monitor/api/redis/keys?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: KeysResponse = await res.json();
      setData(json);
    } catch (err) {
      toast.error(`Failed to load keys: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys(pattern, limit);
  }, [fetchKeys, pattern, limit]);

  function handleSearch() {
    const pat = inputPattern.trim() || "*";
    setPattern(pat);
  }

  async function handleViewKey(key: string) {
    setViewLoading(true);
    setSelectedKey(null);
    try {
      const res = await fetch(`/api/proxy/redis_monitor/api/redis/key/${encodeURIComponent(key)}`);
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || `Failed to load key`);
        return;
      }
      const json: KeyValue = await res.json();
      setSelectedKey(json);
    } catch (err) {
      toast.error(`Failed to load key: ${err}`);
    } finally {
      setViewLoading(false);
    }
  }

  async function handleDeleteKey(key: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/proxy/redis_monitor/api/redis/key/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || `Failed to delete key`);
        return;
      }
      toast.success(`Key "${key}" deleted`);
      setDeleteTarget(null);
      if (selectedKey?.key === key) setSelectedKey(null);
      await fetchKeys(pattern, limit);
    } catch (err) {
      toast.error(`Failed to delete key: ${err}`);
    } finally {
      setDeleteLoading(false);
    }
  }

  const keys = data?.keys ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Redis Storage</h1>
          <p className="text-sm text-muted-foreground">
            Browse, inspect, and manage Redis keys
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchKeys(pattern, limit)}
          disabled={loading}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Keys in DB
            </CardDescription>
            <CardTitle className="text-3xl">{data?.total ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Showing</CardDescription>
            <CardTitle className="text-3xl">{keys.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {data?.pattern ? `pattern: ${data.pattern}` : "all keys (up to limit)"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Types</CardDescription>
            <CardTitle className="text-3xl">
              {new Set(keys.map((k) => k.type)).size}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {[...new Set(keys.map((k) => k.type))].join(", ") || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Keys
          </CardTitle>
          <CardDescription>
            Use Redis glob patterns: <code className="text-xs bg-muted px-1 rounded">*</code> matches
            anything, <code className="text-xs bg-muted px-1 rounded">?</code> matches one char,{" "}
            <code className="text-xs bg-muted px-1 rounded">celery-task-meta-*</code> for Celery results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="e.g. celery-task-meta-*, user:*, *"
              value={inputPattern}
              onChange={(e) => setInputPattern(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="font-mono"
            />
            <Input
              type="number"
              placeholder="Limit"
              value={limit}
              onChange={(e) => setLimit(Math.min(1000, parseInt(e.target.value) || 200))}
              className="w-24"
              min={1}
              max={1000}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Keys ({keys.length})</CardTitle>
          {data?.pattern && (
            <CardDescription>
              Filtered by: <code className="font-mono text-xs">{data.pattern}</code>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading keys…
            </div>
          ) : keys.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No keys found{data?.pattern ? ` matching "${data.pattern}"` : ""}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-28">TTL</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.key} className="group">
                    <TableCell className="font-mono text-xs max-w-[400px] truncate">
                      {k.key}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_COLORS[k.type] ?? "outline"} className="text-xs">
                        {k.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTTL(k.ttl)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleViewKey(k.key)}
                          title="View value"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(k.key)}
                          title="Delete key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Key Dialog */}
      <Dialog open={!!selectedKey || viewLoading} onOpenChange={() => setSelectedKey(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm break-all">
              {selectedKey?.key ?? "Loading…"}
            </DialogTitle>
            {selectedKey && (
              <DialogDescription className="flex items-center gap-2">
                <Badge variant={TYPE_COLORS[selectedKey.type] ?? "outline"}>
                  {selectedKey.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  TTL: {formatTTL(selectedKey.ttl)}
                </span>
              </DialogDescription>
            )}
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading value…
            </div>
          ) : selectedKey ? (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-3 pr-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Value
                </p>
                {typeof selectedKey.value === "string" ? (
                  <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap break-all">
                    {selectedKey.value}
                  </pre>
                ) : (
                  <JsonViewer data={selectedKey.value} />
                )}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(selectedKey.key);
                      setSelectedKey(null);
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete Key
                  </Button>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Redis Key
            </DialogTitle>
            <DialogDescription>
              This action is irreversible. The key and its data will be permanently removed from Redis.
            </DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs bg-muted rounded p-2 break-all">
            {deleteTarget}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDeleteKey(deleteTarget)}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
