"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { OrgPicker } from "@/components/org-picker";
import {
  SortableHeader,
  cycleSort,
  type SortState,
} from "@/components/sortable-header";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface Bot {
  id: string;
  org_id: string;
  deal_id: string | null;
  deal_name: string | null;
  meeting_url: string | null;
  meeting_platform: string | null;
  recording_processed: boolean;
  in_meeting: boolean;
  category: string | null;
  language: string | null;
  created_at: string;
}

interface Filters {
  orgId: string;
  statusFilter: string;
  search: string;
  sort: SortState;
  offset: number;
}

const LIMIT = 25;

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    orgId: "all",
    statusFilter: "all",
    search: "",
    sort: { column: null, direction: null },
    offset: 0,
  });

  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = ++fetchIdRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.orgId !== "all") params.set("org_id", filters.orgId);
    if (filters.statusFilter !== "all") params.set("status", filters.statusFilter);
    if (filters.search) params.set("search", filters.search);
    if (filters.sort.column) params.set("sort_by", filters.sort.column);
    if (filters.sort.direction) params.set("sort_dir", filters.sort.direction);
    params.set("limit", String(LIMIT));
    params.set("offset", String(filters.offset));

    fetch(`/api/bots?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (id !== fetchIdRef.current) return;
        setBots(data.bots || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        if (id !== fetchIdRef.current) return;
        setBots([]);
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
      offset: 0,
    }));
  }

  const columns = [
    { key: "id", label: "Bot ID" },
    { key: "org_id", label: "Org" },
    { key: "deal_name", label: "Deal" },
    { key: "meeting_platform", label: "Platform" },
    { key: "category", label: "Category" },
    { key: "in_meeting", label: "Status" },
    { key: "created_at", label: "Created" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bot Monitor</h1>
        <p className="text-sm text-muted-foreground">View and manage meeting bots</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by bot ID, meeting URL, or deal ID..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value, offset: 0 }))
                }
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <OrgPicker
                value={filters.orgId}
                onChange={(orgId) =>
                  setFilters((prev) => ({ ...prev, orgId, offset: 0 }))
                }
              />
              <Select
                value={filters.statusFilter}
                onValueChange={(statusFilter) =>
                  setFilters((prev) => ({ ...prev, statusFilter, offset: 0 }))
                }
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="in_meeting">Active</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{total} bots found</p>
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
                {bots.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell>
                      <Link
                        href={`/bots/${bot.id}`}
                        className="font-mono text-xs text-blue-400 hover:underline"
                      >
                        {bot.id.slice(0, 16)}…
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{bot.org_id}</TableCell>
                    <TableCell className="text-xs">
                      {bot.deal_name ? (
                        <Link
                          href={`/deals?search=${bot.deal_id}`}
                          className="text-blue-400 hover:underline"
                        >
                          {bot.deal_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{bot.meeting_platform || "-"}</TableCell>
                    <TableCell>
                      {bot.category ? (
                        <Badge variant="outline">{bot.category}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {bot.in_meeting ? (
                        <Badge variant="default">Active</Badge>
                      ) : bot.recording_processed ? (
                        <Badge variant="secondary">Processed</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(bot.created_at), "MMM d, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {!bots.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No bots found
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                : "0 results"}
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
    </div>
  );
}
