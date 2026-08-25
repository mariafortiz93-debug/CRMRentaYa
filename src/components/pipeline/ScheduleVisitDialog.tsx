"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// 8:00am a 5:00pm en franjas de 1 hora (la ultima inicia 4pm y termina 5pm)
const HOUR_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

function slotLabel(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const display = h <= 12 ? h : h - 12;
  return `${display}:00 ${period}`;
}

interface VisitRow {
  id: string;
  contactId: string;
  visitador: string;
  neighborhood: string | null;
  scheduledAt: string | number;
  contactName: string | null;
}

function toDate(v: string | number): Date {
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  return new Date(v);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface ScheduleVisitDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactNeighborhood: string | null;
  contactAddress?: string | null;
  contactCity?: string | null;
  onScheduled?: () => void;
}

export function ScheduleVisitDialog({
  open,
  onClose,
  contactId,
  contactNeighborhood,
  contactAddress,
  contactCity,
  onScheduled,
}: ScheduleVisitDialogProps) {
  const [visitadores, setVisitadores] = useState<string[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitador, setVisitador] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  const [neighborhood, setNeighborhood] = useState(contactNeighborhood || "");
  const [submitting, setSubmitting] = useState(false);

  // Si el contacto ya tiene una visita, entramos en modo reprogramar.
  const existingVisit = useMemo(() => {
    return (
      visits
        .filter((v) => v.contactId === contactId)
        .sort((a, b) => toDate(b.scheduledAt).getTime() - toDate(a.scheduledAt).getTime())[0] || null
    );
  }, [visits, contactId]);
  const isReschedule = !!existingVisit;

  const loadVisits = () => {
    fetch("/api/visits")
      .then((r) => r.json())
      .then(setVisits)
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/crm-config.json")
      .then((r) => r.json())
      .then((cfg) => setVisitadores(cfg.visitadores || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) loadVisits();
  }, [open]);

  // Prefill cuando hay una visita existente (reprogramar); defaults si es nueva.
  useEffect(() => {
    if (!open) return;
    if (existingVisit) {
      const d = toDate(existingVisit.scheduledAt);
      setVisitador(existingVisit.visitador);
      setDate(dateKey(d));
      setHour(d.getHours());
      setNeighborhood(existingVisit.neighborhood || contactNeighborhood || "");
    } else {
      setNeighborhood(contactNeighborhood || "");
    }
  }, [open, existingVisit, contactNeighborhood]);

  useEffect(() => {
    if (visitadores.length > 0 && !visitador && !existingVisit) {
      setVisitador(visitadores[0]);
    }
  }, [visitadores, visitador, existingVisit]);

  // Visitas del dia seleccionado, agrupadas por visitador.
  const dayAgenda = useMemo(() => {
    if (!date) return {} as Record<string, Array<{ hour: number; name: string; visitId: string }>>;
    const map: Record<string, Array<{ hour: number; name: string; visitId: string }>> = {};
    for (const v of visits) {
      const d = toDate(v.scheduledAt);
      if (dateKey(d) !== date) continue;
      (map[v.visitador] ||= []).push({
        hour: d.getHours(),
        name: v.contactName || "",
        visitId: v.id,
      });
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.hour - b.hour);
    return map;
  }, [visits, date]);

  // Horas ocupadas por el visitador seleccionado ese dia (excluyendo la visita que se edita).
  const takenHours = useMemo(() => {
    const set = new Set<number>();
    if (!date || !visitador) return set;
    for (const v of visits) {
      if (v.visitador !== visitador) continue;
      if (existingVisit && v.id === existingVisit.id) continue;
      const d = toDate(v.scheduledAt);
      if (dateKey(d) === date) set.add(d.getHours());
    }
    return set;
  }, [visits, date, visitador, existingVisit]);

  const handleSubmit = async () => {
    if (!date) return toast.error("Selecciona una fecha");
    if (!visitador) return toast.error("Selecciona un visitador");
    if (hour === null) return toast.error("Selecciona una hora");
    if (takenHours.has(hour)) return toast.error("Ese visitador ya tiene una visita a esa hora");

    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
      const res = isReschedule
        ? await fetch(`/api/visits/${existingVisit.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visitador, neighborhood, scheduledAt: scheduledAt.toISOString() }),
          })
        : await fetch("/api/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId, visitador, neighborhood, scheduledAt: scheduledAt.toISOString() }),
          });
      if (!res.ok) throw new Error("Error");
      toast.success(isReschedule ? "Visita reprogramada" : "Visita agendada. Pasa a la etapa Visita.");
      onScheduled?.();
      onClose();
    } catch {
      toast.error("Error al guardar la visita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isReschedule ? "Reprogramar visita" : "Agendar visita"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Visitador</Label>
              <Select value={visitador} onValueChange={(v) => v && setVisitador(v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {visitadores.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visit-date">Fecha</Label>
              <Input
                id="visit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Selector de hora con bloqueo de horas ocupadas */}
          <div className="space-y-2">
            <Label>Hora {visitador ? `de ${visitador}` : ""}</Label>
            <div className="grid grid-cols-3 gap-2">
              {HOUR_SLOTS.map((h) => {
                const taken = takenHours.has(h);
                const selected = hour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={taken}
                    onClick={() => setHour(h)}
                    className={`rounded-md border px-2 py-1.5 text-sm transition-all ${
                      taken
                        ? "bg-muted text-muted-foreground/50 line-through cursor-not-allowed"
                        : selected
                          ? "bg-primary text-primary-foreground border-primary cursor-pointer"
                          : "cursor-pointer hover:bg-muted"
                    }`}
                    title={taken ? "Ocupado" : undefined}
                  >
                    {slotLabel(h)}
                  </button>
                );
              })}
            </div>
            {!date && (
              <p className="text-xs text-muted-foreground">
                Selecciona una fecha para ver la disponibilidad.
              </p>
            )}
          </div>

          {/* Agenda del dia: quien esta ocupado */}
          {date && visitadores.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Agenda del {date.split("-").reverse().join("/")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {visitadores.map((v) => (
                  <div key={v} className="text-xs">
                    <p className="font-semibold">{v}</p>
                    {(dayAgenda[v] || []).length === 0 ? (
                      <p className="text-muted-foreground">Libre todo el dia</p>
                    ) : (
                      (dayAgenda[v] || []).map((slot) => (
                        <p key={slot.visitId} className="text-muted-foreground">
                          {slotLabel(slot.hour)} · {slot.name}
                        </p>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="visit-neighborhood">Barrio / Zona</Label>
            <Input
              id="visit-neighborhood"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Barrio donde vive el cliente"
            />
            {(contactAddress || contactCity) && (
              <p className="text-xs text-muted-foreground">
                Direccion registrada:{" "}
                {[contactAddress, contactCity].filter(Boolean).join(", ")}
              </p>
            )}
            {!contactNeighborhood && (
              <p className="text-xs text-amber-700">
                Este cliente no tiene barrio en su registro. Escribelo aqui y
                completalo luego en su ficha.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="cursor-pointer">
              {submitting ? "Guardando..." : isReschedule ? "Reprogramar" : "Agendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
