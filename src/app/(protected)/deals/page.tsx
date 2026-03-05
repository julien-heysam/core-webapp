"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { JsonViewer } from "@/components/json-viewer";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgPicker } from "@/components/org-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SortableHeader,
  cycleSort,
  type SortState,
} from "@/components/sortable-header";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Deal {
  id: string;
  name: string;
  display_name: string | null;
  status: string | null;
  org_id: string;
  org_name: string;
  crm_deal_id: string | null;
  crm_deal_mapping_reason: string | null;
  stage: string | null;
  email_domain: string | null;
  bot_count: number;
  created_at: string;
}

interface DealDetail {
  deal: Record<string, unknown>;
  bots: Array<Record<string, unknown>>;
  spicedSummary: Record<string, unknown> | null;
  knowledgeExtractions: Array<Record<string, unknown>>;
  discoveryQuestions: Array<Record<string, unknown>>;
}

interface Filters {
  orgId: string;
  search: string;
  sort: SortState;
  offset: number;
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
      <DealsPageInner />
    </Suspense>
  );
}

const LIMIT = 25;

function DealsPageInner() {
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    orgId: "all",
    search: searchParams.get("search") || "",
    sort: { column: null, direction: null },
    offset: 0,
  });
  const [selectedDeal, setSelectedDeal] = useState<DealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Use a ref to track the latest fetch so stale responses are ignored
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = ++fetchIdRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.orgId !== "all") params.set("org_id", filters.orgId);
    if (filters.search) params.set("search", filters.search);
    if (filters.sort.column) params.set("sort_by", filters.sort.column);
    if (filters.sort.direction) params.set("sort_dir", filters.sort.direction);
    params.set("limit", String(LIMIT));
    params.set("offset", String(filters.offset));

    fetch(`/api/deals?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (id !== fetchIdRef.current) return; // stale response — discard
        setDeals(data.deals || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        if (id !== fetchIdRef.current) return;
        setDeals([]);
      })
      .finally(() => {
        if (id !== fetchIdRef.current) return;
        setLoading(false);
      });
  }, [filters]);

  function handleSort(column: string) {
    setFilters((prev) => ({
      ...prev,
      sort: cycleSort(prev.sort, column),
      offset: 0, // reset to page 1 in the same state update — no double-fetch
    }));
  }

  function handleOrgChange(orgId: string) {
    setFilters((prev) => ({ ...prev, orgId, offset: 0 }));
  }

  function handleSearchChange(search: string) {
    setFilters((prev) => ({ ...prev, search, offset: 0 }));
  }

  async function openDetail(dealId: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      const data = await res.json();
      setSelectedDeal(data);
    } catch {
      setSelectedDeal(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "org_name", label: "Org" },
    { key: "stage", label: "Stage" },
    { key: "crm_deal_id", label: "CRM" },
    { key: "bot_count", label: "Bots" },
    { key: "created_at", label: "Created" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deal Inspector</h1>
        <p className="text-sm text-muted-foreground">Browse and debug deal data</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by deal name or ID..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <OrgPicker value={filters.orgId} onChange={handleOrgChange} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <SortableHeader
                      key={col.key}
                      column={col.key}
                      label={col.label}
                      sort={filters.sort}
                      onSort={handleSort}
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(deal.id)}
                  >
                    <TableCell>
                      <span className="font-medium">
                        {deal.display_name || deal.name}
                      </span>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {deal.id.slice(0, 16)}…
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">{deal.org_name}</TableCell>
                    <TableCell>
                      {deal.stage ? (
                        <Badge variant="outline">{deal.stage}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {deal.crm_deal_id ? (
                        <Badge variant="secondary">Matched</Badge>
                      ) : (
                        <Badge variant="outline">Unmatched</Badge>
                      )}
                    </TableCell>
                    <TableCell>{deal.bot_count}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(deal.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
                {!deals.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No deals found
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total > 0
                ? `Showing ${filters.offset + 1}–${Math.min(filters.offset + LIMIT, total)} of ${total}`
                : `${total} deals found`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.offset === 0}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - LIMIT),
                  }))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.offset + LIMIT >= total}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, offset: prev.offset + LIMIT }))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedDeal || detailLoading}
        onOpenChange={() => setSelectedDeal(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedDeal
                ? (selectedDeal.deal.display_name as string) ||
                  (selectedDeal.deal.name as string)
                : "Loading..."}
            </DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <ScrollArea className="max-h-[70vh]">
              <Tabs defaultValue="overview">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="bots">
                    Bots ({selectedDeal.bots.length})
                  </TabsTrigger>
                  <TabsTrigger value="spiced">SPICED</TabsTrigger>
                  <TabsTrigger value="knowledge">
                    Knowledge ({selectedDeal.knowledgeExtractions.length})
                  </TabsTrigger>
                  <TabsTrigger value="discovery">
                    Discovery ({selectedDeal.discoveryQuestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Org</p>
                      <p>{selectedDeal.deal.org_name as string}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stage</p>
                      <p>{(selectedDeal.deal.stage as string) || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CRM Deal ID</p>
                      <p className="font-mono text-xs">
                        {(selectedDeal.deal.crm_deal_id as string) || "Not matched"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CRM Reason</p>
                      <p className="text-xs">
                        {(selectedDeal.deal.crm_deal_mapping_reason as string) || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email Domain</p>
                      <p>{(selectedDeal.deal.email_domain as string) || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Owner</p>
                      <p>{(selectedDeal.deal.owner as string) || "N/A"}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="bots" className="mt-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bot ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDeal.bots.map((bot) => (
                          <TableRow key={bot.id as string}>
                            <TableCell>
                              <Link
                                href={`/bots/${bot.id}`}
                                className="font-mono text-xs text-blue-400 hover:underline"
                              >
                                {(bot.id as string).slice(0, 16)}…
                              </Link>
                            </TableCell>
                            <TableCell>
                              {bot.recording_processed ? (
                                <Badge variant="secondary">Processed</Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>{(bot.category as string) || "-"}</TableCell>
                            <TableCell className="text-xs">
                              {format(
                                new Date(bot.created_at as string),
                                "MMM d, HH:mm"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="spiced" className="mt-4">
                  {selectedDeal.spicedSummary ? (
                    <JsonViewer data={selectedDeal.spicedSummary} />
                  ) : (
                    <p className="text-muted-foreground">No SPICED summary</p>
                  )}
                </TabsContent>

                <TabsContent value="knowledge" className="mt-4">
                  {selectedDeal.knowledgeExtractions.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDeal.knowledgeExtractions.map((ke, i) => (
                        <Card key={i}>
                          <CardContent className="p-3">
                            <JsonViewer data={ke} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No knowledge extractions</p>
                  )}
                </TabsContent>

                <TabsContent value="discovery" className="mt-4">
                  {selectedDeal.discoveryQuestions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Answer</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDeal.discoveryQuestions.map((dq, i) => (
                            <TableRow key={i}>
                              <TableCell>{dq.number as number}</TableCell>
                              <TableCell className="text-xs max-w-xs">
                                {dq.question as string}
                              </TableCell>
                              <TableCell className="text-xs max-w-xs">
                                {(dq.answer as string) || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {(dq.deal_status as string) || "pending"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No discovery questions</p>
                  )}
                </TabsContent>

                <TabsContent value="raw" className="mt-4">
                  <JsonViewer data={selectedDeal.deal} className="max-h-96" />
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
