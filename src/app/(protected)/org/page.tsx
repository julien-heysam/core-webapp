"use client";

import { useEffect, useState, useMemo } from "react";
import { JsonViewer } from "@/components/json-viewer";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SortableHeader,
  cycleSort,
  sortData,
  type SortState,
} from "@/components/sortable-header";

interface Org {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface OrgDetail {
  org: Record<string, unknown>;
  products: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  features: Array<Record<string, unknown>>;
  botCount: number;
  dealCount: number;
}

export default function OrgPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  useEffect(() => {
    fetch("/api/orgs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data);
        else setOrgs([]);
      })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => sortData(orgs, sort), [orgs, sort]);

  async function openDetail(orgId: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}`);
      const data = await res.json();
      setSelected(data);
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "id", label: "ID" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground">
          View org configurations and settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>{orgs.length} organizations</CardDescription>
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
                    sort={sort}
                    onSort={(c) => setSort(cycleSort(sort, c))}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((org) => (
                <TableRow
                  key={org.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(org.id)}
                >
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="font-mono text-xs">{org.id}</TableCell>
                  <TableCell>
                    <Badge
                      variant={org.status === "active" ? "default" : "outline"}
                    >
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {org.created_at
                      ? format(new Date(org.created_at), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selected || detailLoading}
        onOpenChange={() => setSelected(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {selected ? (selected.org.name as string) : "Loading..."}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[70vh]">
              <Tabs defaultValue="config">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                  <TabsTrigger value="products">
                    Products ({selected.products.length})
                  </TabsTrigger>
                  <TabsTrigger value="users">
                    Users ({selected.users.length})
                  </TabsTrigger>
                  <TabsTrigger value="features">
                    Features ({selected.features.length})
                  </TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["Status", selected.org.status],
                      ["Sales Framework", selected.org.sales_framework],
                      ["Language", selected.org.language],
                      ["Post Call Processing", String(selected.org.post_call_processing)],
                      ["In Call Processing", String(selected.org.in_call_processing)],
                      ["Call Ingestion", String(selected.org.enable_call_ingestion)],
                      ["Mail Ingestion", String(selected.org.enable_mail_ingestion)],
                      ["Notifications", String(selected.org.send_notification)],
                      ["Bot Name", selected.org.bot_name],
                      ["Intelligence Type", selected.org.intelligence_type],
                      ["Bots Count", selected.botCount],
                      ["Deals Count", selected.dealCount],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-sm text-muted-foreground">{label as string}</p>
                        <p className="text-sm font-medium">
                          {String(value ?? "N/A")}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="products" className="mt-4">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.products.map((p) => (
                        <TableRow key={p.id as string}>
                          <TableCell>{p.name as string}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {(p.id as string).slice(0, 16)}...
                          </TableCell>
                          <TableCell className="text-xs">
                            {p.created_at
                              ? format(new Date(p.created_at as string), "MMM d, yyyy")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="mt-4">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.users.map((u) => (
                        <TableRow key={u.id as string}>
                          <TableCell className="text-xs">{u.email as string}</TableCell>
                          <TableCell>{u.name as string}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{(u.role as string) || "user"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </TabsContent>

                <TabsContent value="features" className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {selected.features.map((f) => (
                      <Badge key={f.id as string} variant="secondary">
                        {f.name as string}
                      </Badge>
                    ))}
                    {selected.features.length === 0 && (
                      <p className="text-muted-foreground">No features</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="raw" className="mt-4">
                  <JsonViewer data={selected.org} className="max-h-96" />
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
