"use client";

import { Card } from "@/components/ui/card";
import { SOURCE_LABELS, cleanPhoneForWhatsApp } from "@/lib/constants";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Phone, MessageCircle } from "lucide-react";
import type { LeadSource, NextAction } from "@/types";

interface ContactCardProps {
  id: string;
  name: string;
  phone: string | null;
  source: string;
  nextAction: NextAction | null;
}

export function ContactCard({ id, name, phone, source, nextAction }: ContactCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="space-y-2">
        <p className="text-sm font-medium leading-tight">{name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{SOURCE_LABELS[source as LeadSource] || source}</span>
          {phone && nextAction && (
            <a
              href={
                nextAction === "whatsapp"
                  ? `https://wa.me/${cleanPhoneForWhatsApp(phone)}`
                  : `tel:${phone}`
              }
              target={nextAction === "whatsapp" ? "_blank" : undefined}
              rel={nextAction === "whatsapp" ? "noopener noreferrer" : undefined}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
                nextAction === "whatsapp"
                  ? "text-green-600 hover:bg-green-50"
                  : "text-blue-600 hover:bg-blue-50"
              }`}
            >
              {nextAction === "whatsapp" ? (
                <MessageCircle className="h-3 w-3" />
              ) : (
                <Phone className="h-3 w-3" />
              )}
              {nextAction === "whatsapp" ? "WhatsApp" : "Llamar"}
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
