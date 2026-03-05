"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { subDays, format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgPicker } from "@/components/org-picker";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SortableHeader,
  cycleSort,
  sortData,
  type SortState,
} from "@/components/sortable-header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DateRange } from "react-day-picker";
import Link from "next/link";
import { Mail, Bot, Briefcase, TrendingUp } from "lucide-react";

interface DashboardData {
  emails: { total: string; success: string; failed: string } | null;
  bots: { total: string; processed: string; in_meeting: string } | null;
  deals: { total: string; with_crm: string } | null;
  recentBots: Array<Record<string, unknown>>;
  emailTimeline: Array<{ date: string; success: number; failed: number }>;
}

export default function DashboardPage() {
  const [orgId, setOrgId] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (orgId !== "all") params.set("org_id", orgId);
    if (dateRange?.from) params.set("from", dateRange.from.toISOString());
    if (dateRange?.to) params.set("to", dateRange.to.toISOString());

    try {
      const res = await fetch(`/api/proxy/admin/dashboard?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recentBots = useMemo(
    () => sortData(data?.recentBots || [], sort),
    [data?.recentBots, sort]
  );

  const stats = [
    {
      title: "Total Emails",
      value: data?.emails?.total || "0",
      sub: `${data?.emails?.success || 0} sent · ${data?.emails?.failed || 0} failed`,
      icon: Mail,
      color: "text-blue-400",
      iconBg: "bg-blue-400/10",
    },
    {
      title: "Total Bots",
      value: data?.bots?.total || "0",
      sub: `${data?.bots?.processed || 0} processed · ${data?.bots?.in_meeting || 0} active`,
      icon: Bot,
      color: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
    },
    {
      title: "Total Deals",
      value: data?.deals?.total || "0",
      sub: `${data?.deals?.with_crm || 0} matched to CRM`,
      icon: Briefcase,
      color: "text-violet-400",
      iconBg: "bg-violet-400/10",
    },
    {
      title: "Email Success Rate",
      value:
        data?.emails && parseInt(data.emails.total) > 0
          ? `${Math.round((parseInt(data.emails.success) / parseInt(data.emails.total)) * 100)}%`
          : "N/A",
      sub: "Delivery rate",
      icon: TrendingUp,
      color: "text-amber-400",
      iconBg: "bg-amber-400/10",
    },
  ];

  const botColumns = [
    { key: "id", label: "Bot ID" },
    { key: "org_id", label: "Org" },
    { key: "in_meeting", label: "Status" },
    { key: "created_at", label: "Created" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of system metrics and activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrgPicker value={orgId} onChange={setOrgId} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    {stat.title}
                  </CardDescription>
                  <div className={`rounded-md p-1.5 ${stat.iconBg}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <CardTitle className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? (
                    <span className="text-muted-foreground/40">—</span>
                  ) : (
                    stat.value
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {loading ? "" : stat.sub}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email Activity</CardTitle>
            <CardDescription>Sent vs failed over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {data?.emailTimeline && data.emailTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...data.emailTimeline].reverse()} barSize={8}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), "MMM d")}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="success" fill="oklch(0.696 0.17 162.48)" name="Sent" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="failed" fill="oklch(0.645 0.246 16.439)" name="Failed" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Bots</CardTitle>
            <CardDescription>Latest meeting bots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {botColumns.map((col) => (
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
                  {recentBots.map((bot) => (
                    <TableRow key={bot.id as string}>
                      <TableCell>
                        <Link
                          href={`/bots/${bot.id}`}
                          className="font-mono text-xs text-blue-400 hover:underline"
                        >
                          {(bot.id as string).slice(0, 12)}…
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{bot.org_id as string}</TableCell>
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
                        {format(new Date(bot.created_at as string), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.recentBots?.length && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No recent bots
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
