"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  RotateCcw,
  MessageSquare,
  Database,
  Handshake,
  Terminal,
  Layers,
  Building2,
  LogOut,
  Zap,
  Timer,
  HardDrive,
  Activity,
  Cpu,
  Brain,
  Bell,
  Radio,
  Gauge,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Queue Monitor", href: "/queues", icon: Layers },
      { title: "Redis Storage", href: "/redis-storage", icon: HardDrive },
      { title: "Trackers", href: "/trackers", icon: Timer },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Infrastructure", href: "/monitoring", icon: Activity },
      { title: "Celery Workers", href: "/monitoring/celery", icon: Cpu },
      { title: "LLM Performance", href: "/monitoring/llm", icon: Brain },
      { title: "Alerts", href: "/monitoring/alerts", icon: Bell },
      { title: "Live Calls", href: "/live", icon: Radio },
      { title: "Live Q Pipeline", href: "/monitoring/live-question-pipeline", icon: Gauge },
    ],
  },
  {
    label: "Data",
    items: [
      { title: "Bots", href: "/bots", icon: Bot },
      { title: "Deals", href: "/deals", icon: Handshake },
      { title: "Organizations", href: "/org", icon: Building2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "Post-Processing", href: "/post-processing", icon: RotateCcw },
      { title: "Debug Chat", href: "/chat", icon: MessageSquare },
      { title: "Pinecone Explorer", href: "/pinecone", icon: Database },
      { title: "Script Runner", href: "/scripts", icon: Terminal },
      { title: "Realtime Q Detection", href: "/realtime-question-test", icon: Radio },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-3">
        <Link href="/dashboard" className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">HeySam</span>
            <span className="text-[11px] text-muted-foreground leading-none mt-1">Admin Console</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, i) => (
          <div key={group.label}>
            {i > 0 && <SidebarSeparator />}
            <SidebarGroup>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          size="sm"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
