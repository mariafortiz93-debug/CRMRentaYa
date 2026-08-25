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
import { CLASSIFICATION_CONFIG, CLASSIFICATION_ORDER, PLAN_CONFIG } from "@/lib/constants";
import { toast } from "sonner";
import type { Classification, ClassificationDestination, Plan } from "@/types";

interface ClassificationDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  currentClassification?: string | null;
  currentDetail?: string | null;
  currentPlan?: string | null;
  /** Recibe el nombre de la etapa destino. */
  onSaved?: (destination: ClassificationDestination) => void;
}

export function ClassificationDialog({
  open,
  onClose,
  contactId,
  currentClassification,
  currentDetail,
  currentPlan,
  onSaved,
}: ClassificationDialogProps) {
  const [selected, setSelected] = useState<Classification | null>(null);
  const [detail, setDetail] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected((currentClassification as Classification) || null);
      setDetail(currentDetail || "");
      setPlan((currentPlan as Plan) || null);
    }
  }, [open, currentClassification, currentDetail, currentPlan]);

  const cfg = selected ? CLASSIFICATION_CONFIG[selected] : null;
  const needsDetail = !!cfg?.detailLabel;

  const handleSave = async () => {
    if (!selected || !cfg) return toast.error("Selecciona una clasificacion");
    if (needsDetail && !detail.trim()) {
      return toast.error(cfg.detailLabel);
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classification: selected,
          classificationDetail: needsDetail ? detail.trim() : null,
          plan,
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success(`Clasificado: ${cfg.label}. Pasa a ${cfg.destination}.`);
      onSaved?.(cfg.destination);
      onClose();
    } catch {
      toast.error("Error al guardar la clasificacion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clasificar cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan del cliente</Label>
            <div className="flex gap-2">
              {(["asalariado", "trabajo"] as const).map((p) => {
                const cfg = PLAN_CONFIG[p];
                const active = plan === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(active ? null : p)}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium border cursor-pointer transition-all"
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
          </div>

          <p className="text-sm text-muted-foreground border-t pt-4">
            Selecciona por que el cliente quedo en este estado despues de contactarlo.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {CLASSIFICATION_ORDER.map((key) => {
              const c = CLASSIFICATION_CONFIG[key];
              const active = selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className="rounded-lg px-3 py-2 text-sm font-medium border cursor-pointer transition-all text-left"
                  style={{
                    backgroundColor: active ? c.bgColor : "transparent",
                    color: active ? c.color : undefined,
                    borderColor: active ? c.color : "var(--border)",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {needsDetail && cfg && (
            <div className="space-y-2">
              <Label htmlFor="classification-detail">{cfg.detailLabel}</Label>
              <Input
                id="classification-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Escribe aqui..."
              />
            </div>
          )}

          {cfg && (
            <p className="text-xs text-muted-foreground">
              Al guardar, el cliente pasa a la etapa <strong>{cfg.destination}</strong>.
            </p>
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
