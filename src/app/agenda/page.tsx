"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface VisitRow {
  id: string;
  contactId: string;
  visitador: string;
  neighborhood: string | null;
  scheduledAt: string | number;
  contactName: string | null;
  contactPhone: string | null;
}

const VISITADOR_COLORS = [
  { bg: "#dbeafe", text: "#1d4ed8", dot: "#2563eb" }, // azul
  { bg: "#dcfce7", text: "#15803d", dot: "#16a34a" }, // verde
  { bg: "#ffedd5", text: "#c2410c", dot: "#ea580c" }, // naranja
  { bg: "#fae8ff", text: "#a21caf", dot: "#c026d3" }, // fucsia
];

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toDate(v: string | number): Date {
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  return new Date(v);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hourLabel(d: Date): string {
  let h = d.getHours();
  const period = h < 12 ? "am" : "pm";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}${period}`;
}

export default function AgendaPage() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitadores, setVisitadores] = useState<string[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    fetch("/api/visits")
      .then((r) => r.json())
      .then(setVisits)
      .catch(() => {});
    fetch("/crm-config.json")
      .then((r) => r.json())
      .then((cfg) => setVisitadores(cfg.visitadores || []))
      .catch(() => {});
  }, []);

  const colorFor = (visitador: string) => {
    const idx = visitadores.indexOf(visitador);
    return VISITADOR_COLORS[(idx < 0 ? 0 : idx) % VISITADOR_COLORS.length];
  };

  const visitsByDay = useMemo(() => {
    const map: Record<string, VisitRow[]> = {};
    for (const v of visits) {
      const key = dateKey(toDate(v.scheduledAt));
      (map[key] ||= []).push(v);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => toDate(a.scheduledAt).getTime() - toDate(b.scheduledAt).getTime());
    }
    return map;
  }, [visits]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7; // lunes = 0
    const result: Array<{ day: number; date: Date } | null> = [];
    for (let i = 0; i < leading; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, date: new Date(cursor.year, cursor.month, d) });
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cursor]);

  const todayKey = dateKey(new Date());

  const prevMonth = () =>
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const nextMonth = () =>
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda de Visitas</h1>
          <p className="text-muted-foreground">
            Planeador mensual por hora, barrio y visitador
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-40 text-center">
            {MONTHS[cursor.month]} {cursor.year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth} className="cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {visitadores.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {visitadores.map((v) => (
            <div key={v} className="flex items-center gap-1.5 text-sm">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colorFor(v).dot }}
              />
              {v}
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitas del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-muted/50 text-center text-xs font-medium py-2">
                {w}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="bg-background min-h-[96px]" />;
              const key = dateKey(cell.date);
              const dayVisits = visitsByDay[key] || [];
              const isToday = key === todayKey;
              return (
                <div key={i} className="bg-background min-h-[96px] p-1.5 space-y-1">
                  <div
                    className={`text-xs font-medium ${
                      isToday ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {cell.day}
                  </div>
                  {dayVisits.map((v) => {
                    const c = colorFor(v.visitador);
                    return (
                      <div
                        key={v.id}
                        className="rounded px-1 py-0.5 text-[10px] leading-tight"
                        style={{ backgroundColor: c.bg, color: c.text }}
                        title={`${v.visitador} · ${hourLabel(toDate(v.scheduledAt))} · ${v.contactName || ""} · ${v.neighborhood || ""}`}
                      >
                        <span className="font-semibold">{hourLabel(toDate(v.scheduledAt))}</span>{" "}
                        {v.contactName}
                        {v.neighborhood ? (
                          <span className="block opacity-80">{v.neighborhood}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
