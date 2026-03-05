"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Org {
  id: string;
  name: string;
}

interface OrgPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function OrgPicker({ value, onChange, className }: OrgPickerProps) {
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    fetch("/api/proxy/admin/orgs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data);
        else setOrgs([]);
      })
      .catch(() => setOrgs([]));
  }, []);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full sm:w-[180px]", className)}>
        <SelectValue placeholder="All orgs" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All organizations</SelectItem>
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
