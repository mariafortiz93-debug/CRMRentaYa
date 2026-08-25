"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MessageCircle, History } from "lucide-react";
import {
  MANAGEMENT_OUTCOME_CONFIG,
  CONTACT_METHOD_CONFIG,
  MANAGEMENT_REASON_CONFIG,
  MANAGEMENT_REASON_ORDER,
} from "@/lib/constants";
import { toast } from "sonner";
import type { ContactMethod, ManagementOutcome, ManagementReason } from "@/types";

function todayParam(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDate(v: string | number): Date {
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  return new Date(v);
}

function formatDateTime(v: string | number): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(v));
}

function formatDay(v: string | number): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(toDate(v));
}

interface LogRow {
  id: string;
  method: string;
  outcome: string;
  promisedDate: string | number | null;
  reason: string | null;
  reasonDetail: string | null;
  note: string | null;
  createdAt: string | number;
}

interface ApprovedCallDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  onSaved?: () => void;
}

export function ApprovedCallDialog({
  open,
  onClose,
  contactId,
  contactName,
  onSaved,
}: ApprovedCallDialogProps) {
  const [method, setMethod] = useState<ContactMethod | null>(null);
  const [outcome, setOutcome] = useState<ManagementOutcome | null>(null);
  const [startDate, setStartDate] = useState("");
  const [reason, setReason] = useState<ManagementReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [saving, setSaving] = useState(false);

  const reasonCfg = reason ? MANAGEMENT_REASON_CONFIG[reason] : null;
  const desistio = reason === "desistio";

  const loadLogs = useCallback(() => {
    fetch(`/api/managements?contactId=${contactId}`)
      .then((r) => r.json())
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [contactId]);

  useEffect(() => {
    if (!open) return;
    setMethod(null);
    setOutcome(null);
    setStartDate(todayParam());
    setReason(null);
    setReasonDetail("");
    setNote("");
    loadLogs();
  }, [open, loadLogs]);

  const handleSave = async () => {
    if (!method) return toast.error("Indica como contactaste al cliente");
    if (!outcome) return toast.error("Indica si el cliente contesto");
    if (outcome === "contesto" && !desistio && !startDate) {
      return toast.error("Indica la fecha de inicio de tramite");
    }
    if (reasonCfg?.detailLabel && !reasonDetail.trim()) {
      return toast.error(reasonCfg.detailLabel);
    }

    setSaving(true);
    try {
      const res = await fetch("/api/managements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          method,
          outcome,
          promisedDate:
            outcome === "contesto" && !desistio
              ? new Date(`${startDate}T12:00:00`).toISOString()
              : null,
          reason,
          reasonDetail: reasonCfg?.detailLabel ? reasonDetail.trim() : null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Error");

      if (desistio) {
        toast.success("Gestion registrada. El cliente paso a Perdido.");
        onSaved?.();
        onClose();
        return;
      }

      toast.success("Gestion registrada");
      setMethod(null);
      setOutcome(null);
      setReason(null);
      setReasonDetail("");
      setNote("");
      loadLogs();
      onSaved?.();
    } catch {
      toast.error("Error al registrar la gestion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestion de {contactName.trim()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Como lo contactaste?</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMethod("whatsapp")}
                className={`flex-1 cursor-pointer ${
                  method === "whatsapp" ? "border-green-600 bg-green-50 text-green-700" : ""
                }`}
              >
                <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMethod("call")}
                className={`flex-1 cursor-pointer ${
                  method === "call" ? "border-blue-600 bg-blue-50 text-blue-700" : ""
                }`}
              >
                <Phone className="h-4 w-4 mr-2 text-blue-600" />
                Llamada
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>El cliente contesto?</Label>
            <div className="flex gap-3">
              {(["contesto", "no_contesto"] as const).map((o) => {
                const cfg = MANAGEMENT_OUTCOME_CONFIG[o];
                const active = outcome === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
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

          {outcome === "contesto" && (
            <>
              <div className="space-y-2">
                <Label>Por que aun no inicia el tramite? (opcional)</Label>
                <div className="grid grid-cols-1 gap-2">
                  {MANAGEMENT_REASON_ORDER.map((r) => {
                    const cfg = MANAGEMENT_REASON_CONFIG[r];
                    const active = reason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(active ? null : r)}
                        className="rounded-lg px-3 py-2 text-sm font-medium border cursor-pointer transition-all text-left"
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

              {reasonCfg?.detailLabel && (
                <div className="space-y-2">
                  <Label htmlFor="reason-detail">{reasonCfg.detailLabel}</Label>
                  <Input
                    id="reason-detail"
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    placeholder="Escribe el motivo..."
                  />
                </div>
              )}

              {desistio ? (
                <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
                  Al guardar, el cliente pasa a la etapa <strong>Perdido</strong>.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="procedure-date">
                    Fecha en que el cliente iniciara el tramite
                  </Label>
                  <Input
                    id="procedure-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="management-note">Observacion (opcional)</Label>
            <Textarea
              id="management-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Que dijo el cliente..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cerrar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Guardando..." : "Registrar gestion"}
            </Button>
          </div>

          {/* Historico */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Historico de gestiones ({logs.length})
            </p>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aun no se ha registrado ninguna gestion.
              </p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const oc = MANAGEMENT_OUTCOME_CONFIG[log.outcome as ManagementOutcome];
                  const mc = CONTACT_METHOD_CONFIG[log.method as ContactMethod];
                  return (
                    <div key={log.id} className="rounded-lg border p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rounded px-1.5 py-0.5 font-medium"
                            style={{ backgroundColor: oc?.bgColor, color: oc?.color }}
                          >
                            {oc?.label || log.outcome}
                          </span>
                          <span className="text-muted-foreground">
                            {mc?.label || log.method}
                          </span>
                        </div>
                        <span className="text-muted-foreground shrink-0">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      {log.promisedDate && (
                        <p className="text-muted-foreground">
                          Prometio iniciar el {formatDay(log.promisedDate)}
                        </p>
                      )}
                      {log.reason && (
                        <p className="font-medium">
                          {MANAGEMENT_REASON_CONFIG[log.reason as ManagementReason]
                            ?.label || log.reason}
                          {log.reasonDetail ? `: ${log.reasonDetail}` : ""}
                        </p>
                      )}
                      {log.note && <p className="text-muted-foreground">{log.note}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
