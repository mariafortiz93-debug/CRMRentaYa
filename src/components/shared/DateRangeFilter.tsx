"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarRange, X } from "lucide-react";

function todayParam(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DateRangeFilterProps {
  from: string;
  to: string;
  /** Texto que describe que se esta filtrando, ej. "leads creados". */
  hint?: string;
}

export function DateRangeFilter({ from, to, hint }: DateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");
    if (nextTo) params.set("to", nextTo);
    else params.delete("to");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const active = !!(from || to);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarRange className="h-4 w-4" />
        <span className="hidden sm:inline">{hint || "Periodo"}</span>
      </div>
      <Input
        type="date"
        aria-label="Desde"
        value={from}
        onChange={(e) => apply(e.target.value, to)}
        className="w-[150px]"
      />
      <span className="text-sm text-muted-foreground pb-2">a</span>
      <Input
        type="date"
        aria-label="Hasta"
        value={to}
        onChange={(e) => apply(from, e.target.value)}
        className="w-[150px]"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => apply(todayParam(), todayParam())}
        className="cursor-pointer"
      >
        Hoy
      </Button>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply("", "")}
          className="cursor-pointer"
        >
          <X className="h-4 w-4 mr-1" />
          Todo
        </Button>
      )}
    </div>
  );
}
