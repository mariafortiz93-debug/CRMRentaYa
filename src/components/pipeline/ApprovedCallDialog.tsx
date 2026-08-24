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
import { Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { ContactMethod } from "@/types";

function todayParam(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface ApprovedCallDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  currentMethod?: string | null;
  currentDate?: number | null;
  onSaved?: () => void;
}

export function ApprovedCallDialog({
  open,
  onClose,
  contactId,
  contactName,
  currentMethod,
  currentDate,
  onSaved,
}: ApprovedCallDialogProps) {
  const [method, setMethod] = useState<ContactMethod | null>(null);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod((currentMethod as ContactMethod) || null);
    setStartDate(
      currentDate
        ? new Date(currentDate).toISOString().slice(0, 10)
        : todayParam()
    );
  }, [open, currentMethod, currentDate]);

  const handleSave = async () => {
    if (!method) return toast.error("Indica como contactaste al cliente");
    if (!startDate) return toast.error("Indica la fecha de inicio de tramite");
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedContactMethod: method,
          procedureStartDate: new Date(`${startDate}T12:00:00`).toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Gestion registrada");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Error al registrar la gestion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestion de llamada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Registra la llamada a <strong>{contactName}</strong> para recordarle que
            inicie el tramite.
          </p>

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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Guardando..." : "Registrar gestion"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
