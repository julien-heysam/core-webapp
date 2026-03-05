"use client";

import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface SortableHeaderProps {
  column: string;
  label: string;
  sort: SortState;
  onSort: (column: string) => void;
}

export function SortableHeader({
  column,
  label,
  sort,
  onSort,
}: SortableHeaderProps) {
  const isActive = sort.column === column;

  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && sort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isActive && sort.direction === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
        )}
      </div>
    </TableHead>
  );
}

export function cycleSort(current: SortState, column: string): SortState {
  if (current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return { column: null, direction: null };
}

export function sortData<T>(data: T[], sort: SortState): T[] {
  if (!sort.column || !sort.direction) return data;

  const col = sort.column;
  const dir = sort.direction === "asc" ? 1 : -1;

  return [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[col];
    const bVal = (b as Record<string, unknown>)[col];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * dir;
    }

    if (typeof aVal === "boolean" && typeof bVal === "boolean") {
      return (Number(aVal) - Number(bVal)) * dir;
    }

    return String(aVal).localeCompare(String(bVal)) * dir;
  });
}
