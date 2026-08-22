"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VISIT_RESULT_CONFIG } from "@/lib/constants";
import { toast } from "sonner";

interface VisitResultDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  currentResult?: string | null;
  currentNote?: string | null;
  onSaved?: (result: string) => void;
}

export function VisitResultDialog({
  open,
  onClose,
  contactId,
  currentResult,
  currentNote,
  onSaved,
}: VisitResultDialogProps) {
  const [result, setResult] = useState<string | null>(currentResult ?? null);
  const [note, setNote] = useState(currentNote ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setResult(currentResult ?? null);
      setNote(currentNote ?? "");
    }
  }, [open, currentResult, currentNote]);

  const needsNote = result === "negado" || result === "sin_proceso";

  const handleSave = async () => {
    if (!result) return toast.error("Selecciona un resultado");
    if (needsNote && !note.trim()) {
      return toast.error("Escribe el motivo");
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitResult: result,
          visitResultNote: needsNote ? note : null,
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Resultado guardado");
      onSaved?.(result);
      onClose();
    } catch {
      toast.error("Error al guardar el resultado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado de la visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["aprobado", "sin_proceso", "negado"] as const).map((r) => {
              const cfg = VISIT_RESULT_CONFIG[r];
              const active = result === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(r)}
                  className="rounded-lg px-3 py-2 text-sm font-medium border cursor-pointer transition-all"
                  style={{
                    backgroundColor: active ? cfg.bgColor : "transparent",
                    color: active ? cfg.color : undefined,
                    borderColor: active ? cfg.color : "var(--border)",
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {needsNote && (
            <div className="space-y-2">
              <Label htmlFor="visit-note">
                Motivo ({result === "negado" ? "por qué fue negado" : "por qué quedó sin proceso"})
              </Label>
              <Textarea
                id="visit-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Escribe el motivo..."
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
