"use client";

import { useEffect, useState } from "react";
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

interface ScheduleVisitDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactNeighborhood: string | null;
  onScheduled?: () => void;
}

export function ScheduleVisitDialog({
  open,
  onClose,
  contactId,
  contactNeighborhood,
  onScheduled,
}: ScheduleVisitDialogProps) {
  const [visitadores, setVisitadores] = useState<string[]>([]);
  const [visitador, setVisitador] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("9");
  const [neighborhood, setNeighborhood] = useState(contactNeighborhood || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/crm-config.json")
      .then((r) => r.json())
      .then((cfg) => {
        const list: string[] = cfg.visitadores || [];
        setVisitadores(list);
        if (list.length > 0) setVisitador(list[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setNeighborhood(contactNeighborhood || "");
  }, [contactNeighborhood, open]);

  const handleSubmit = async () => {
    if (!date) {
      toast.error("Selecciona una fecha");
      return;
    }
    if (!visitador) {
      toast.error("Selecciona un visitador");
      return;
    }
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          visitador,
          neighborhood,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Visita agendada. Pasa a la etapa Visita.");
      onScheduled?.();
      onClose();
    } catch {
      toast.error("Error al agendar la visita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Visitador</Label>
            <Select value={visitador} onValueChange={(v) => v && setVisitador(v)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Selecciona visitador" />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="visit-date">Fecha</Label>
              <Input
                id="visit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Select value={hour} onValueChange={(v) => v && setHour(v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_SLOTS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {slotLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-neighborhood">Barrio / Zona</Label>
            <Input
              id="visit-neighborhood"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Barrio donde vive el cliente"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="cursor-pointer">
              {submitting ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
