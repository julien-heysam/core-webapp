"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bots": "Bot Monitor",
  "/post-processing": "Post-Processing",
  "/chat": "Debug Chat",
  "/pinecone": "Pinecone Explorer",
  "/deals": "Deal Inspector",
  "/scripts": "Script Runner",
  "/queues": "Queue Monitor",
  "/org": "Organizations",
};

export function NavBreadcrumb() {
  const pathname = usePathname();
  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? "";

  if (!title) return null;

  return (
    <span className="text-sm font-medium text-foreground/80">{title}</span>
  );
}
