"use client";

import { useEffect, useState, useMemo } from "react";
import { JsonViewer } from "@/components/json-viewer";
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
import { Textarea } from "@/components/ui/textarea";
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  SortableHeader,
  cycleSort,
  sortData,
  type SortState,
} from "@/components/sortable-header";
import { Search, Database } from "lucide-react";
import { toast } from "sonner";

interface Namespace {
  value: string;
  label: string;
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export default function PineconePage() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [namespace, setNamespace] = useState("");
  const [customNamespace, setCustomNamespace] = useState("");
  const [queryText, setQueryText] = useState("");
  const [topK, setTopK] = useState(10);
  const [filterJson, setFilterJson] = useState("");
  const [results, setResults] = useState<PineconeMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<PineconeMatch | null>(null);
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  useEffect(() => {
    fetch("/api/proxy/admin/pinecone/namespaces")
      .then((res) => res.json())
      .then(setNamespaces)
      .catch(() => setNamespaces([]));
  }, []);

  const sorted = useMemo(() => sortData(results, sort), [results, sort]);

  async function handleQuery() {
    const ns = namespace === "__custom__" ? customNamespace : namespace;
    if (!queryText.trim() || !ns) {
      toast.error("Query and namespace are required");
      return;
    }

    setLoading(true);
    setSort({ column: null, direction: null });
    try {
      let filter = undefined;
      if (filterJson.trim()) {
        try {
          filter = JSON.parse(filterJson);
        } catch {
          toast.error("Invalid filter JSON");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/proxy/admin/pinecone/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          namespace: ns,
          topK,
          filter,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResults(data.matches || []);
        if (data.matches?.length === 0) {
          toast.info("No results found");
        }
      } else {
        toast.error(data.error || "Query failed");
      }
    } catch {
      toast.error("Query failed");
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "score", label: "Score" },
    { key: "id", label: "ID" },
    { key: "metadata", label: "Text Preview" },
    { key: "metadata_keys", label: "Metadata Keys" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pinecone Explorer</h1>
        <p className="text-muted-foreground">
          Query and browse vector store data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Query Vectors
          </CardTitle>
          <CardDescription>
            Search using natural language - embeddings are generated automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Namespace</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger>
                  <SelectValue placeholder="Select namespace" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map((ns) => (
                    <SelectItem key={ns.value} value={ns.value}>
                      {ns.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom namespace...</SelectItem>
                </SelectContent>
              </Select>
              {namespace === "__custom__" && (
                <Input
                  placeholder="Enter custom namespace..."
                  value={customNamespace}
                  onChange={(e) => setCustomNamespace(e.target.value)}
                  className="mt-2 font-mono"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Top K</Label>
              <Input
                type="number"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Query</Label>
            <Textarea
              placeholder="Enter your search query..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Filter (optional JSON){" "}
              <span className="text-muted-foreground">
                e.g. {`{"org_id": {"$eq": "heysam"}}`}
              </span>
            </Label>
            <Input
              placeholder='{"org_id": {"$eq": "heysam"}}'
              value={filterJson}
              onChange={(e) => setFilterJson(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={handleQuery} disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Querying..." : "Search"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results ({results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <SortableHeader
                      key={col.key}
                      column={col.key}
                      label={col.label}
                      sort={sort}
                      onSort={(c) => setSort(cycleSort(sort, c))}
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((match) => (
                  <TableRow
                    key={match.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedMatch(match)}
                  >
                    <TableCell>
                      <Badge variant="secondary">
                        {match.score.toFixed(4)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {match.id}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs">
                      {(match.metadata?.text as string) ||
                        (match.metadata?.content as string) ||
                        (match.metadata?.page_content as string) ||
                        JSON.stringify(match.metadata).slice(0, 100)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {Object.keys(match.metadata || {}).join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!selectedMatch}
        onOpenChange={() => setSelectedMatch(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {selectedMatch?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedMatch && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Score
                  </p>
                  <Badge>{selectedMatch.score.toFixed(6)}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Full Metadata
                  </p>
                  <JsonViewer data={selectedMatch.metadata} />
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
