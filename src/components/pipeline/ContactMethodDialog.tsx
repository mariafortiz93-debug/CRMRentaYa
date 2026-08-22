"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle } from "lucide-react";

interface ContactMethodDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (method: "whatsapp" | "call") => void;
}

export function ContactMethodDialog({ open, onClose, onSelect }: ContactMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Como contactaste a este lead?</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() => onSelect("whatsapp")}
          >
            <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() => onSelect("call")}
          >
            <Phone className="h-4 w-4 mr-2 text-blue-600" />
            Llamada
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
