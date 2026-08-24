"use client";

import { Card } from "@/components/ui/card";
import {
  SOURCE_LABELS,
  VISIT_RESULT_CONFIG,
  CONTACT_METHOD_CONFIG,
  CLASSIFICATION_CONFIG,
  cleanPhoneForWhatsApp,
} from "@/lib/constants";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Phone,
  MessageCircle,
  FileText,
  Calendar,
  ClipboardCheck,
  AlertTriangle,
  UserRound,
  Tag,
} from "lucide-react";
import type {
  LeadSource,
  NextAction,
  VisitResult,
  ContactMethod,
  Classification,
} from "@/types";

const MAX_DAYS_TO_CONTACT = 3;

function daysSince(ms: number | null): number | null {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 86400000);
}

export type CardAction =
  | "diligenciar"
  | "agendar"
  | "reprogramar"
  | "resultado"
  | "iniciar_tramite"
  | "clasificar"
  | null;

interface ContactCardProps {
  id: string;
  name: string;
  phone: string | null;
  source: string;
  nextAction: NextAction | null;
  primaryAction?: CardAction;
  onPrimaryAction?: () => void;
  visitResult?: string | null;
  visitResultDate?: number | null;
  contactMethod?: string | null;
  classification?: string | null;
  classificationDetail?: string | null;
  visitador?: string | null;
  /** Muestra el metodo de contacto y la clasificacion (etapa Contactado). */
  showContactInfo?: boolean;
  /** Muestra el visitador asignado (etapas Visita / Visitas Reagendadas). */
  showVisitador?: boolean;
  /** Las tarjetas de columnas calculadas no se arrastran. */
  draggable?: boolean;
}

export function ContactCard({
  id,
  name,
  phone,
  source,
  nextAction,
  primaryAction,
  onPrimaryAction,
  visitResult,
  visitResultDate,
  contactMethod,
  classification,
  classificationDetail,
  visitador,
  showContactInfo,
  showVisitador,
  draggable = true,
}: ContactCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const resultCfg = visitResult ? VISIT_RESULT_CONFIG[visitResult as VisitResult] : null;
  const methodCfg = contactMethod
    ? CONTACT_METHOD_CONFIG[contactMethod as ContactMethod]
    : null;
  const classCfg = classification
    ? CLASSIFICATION_CONFIG[classification as Classification]
    : null;

  // El contador/alerta solo aplica a aprobados pendientes de llamar.
  const pendingCall = primaryAction === "iniciar_tramite";
  const days = pendingCall ? daysSince(visitResultDate ?? null) : null;
  const overdue = days !== null && days >= MAX_DAYS_TO_CONTACT;

  const dragProps = draggable ? { ...attributes, ...listeners } : {};

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...dragProps}
      className={`p-3 transition-shadow hover:shadow-md ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${overdue ? "border-red-300 bg-red-50" : ""}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{name}</p>
          {resultCfg && (
            <span
              className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0"
              style={{ backgroundColor: resultCfg.bgColor, color: resultCfg.color }}
            >
              {resultCfg.label}
            </span>
          )}
        </div>

        {showContactInfo && (methodCfg || classCfg) && (
          <div className="flex flex-wrap gap-1">
            {methodCfg && (
              <span
                className="text-[10px] font-medium rounded px-1.5 py-0.5"
                style={{ backgroundColor: methodCfg.bgColor, color: methodCfg.color }}
              >
                {methodCfg.label}
              </span>
            )}
            {classCfg && (
              <span
                className="text-[10px] font-medium rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                style={{ backgroundColor: classCfg.bgColor, color: classCfg.color }}
              >
                <Tag className="h-2.5 w-2.5" />
                {classCfg.label}
                {classificationDetail ? `: ${classificationDetail}` : ""}
              </span>
            )}
          </div>
        )}

        {showVisitador && visitador && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <UserRound className="h-3 w-3" />
            Visitador: <span className="font-medium">{visitador}</span>
          </div>
        )}

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

        {days !== null && (
          <div
            className={`flex items-center gap-1 text-[11px] ${
              overdue ? "text-red-600 font-medium" : "text-muted-foreground"
            }`}
          >
            {overdue && <AlertTriangle className="h-3 w-3" />}
            {days === 0
              ? "Aprobado hoy"
              : `Aprobado hace ${days} dia${days === 1 ? "" : "s"}`}
            {overdue ? " · llamar ya" : ""}
          </div>
        )}

        {primaryAction && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPrimaryAction?.();
            }}
            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium py-1.5 cursor-pointer hover:opacity-90"
          >
            {primaryAction === "diligenciar" ? (
              <>
                <FileText className="h-3.5 w-3.5" />
                Diligenciar formulario
              </>
            ) : primaryAction === "reprogramar" ? (
              <>
                <Calendar className="h-3.5 w-3.5" />
                Reprogramar visita
              </>
            ) : primaryAction === "resultado" ? (
              <>
                <ClipboardCheck className="h-3.5 w-3.5" />
                Marcar resultado
              </>
            ) : primaryAction === "iniciar_tramite" ? (
              <>
                <Phone className="h-3.5 w-3.5" />
                Llamar e iniciar tramite
              </>
            ) : primaryAction === "clasificar" ? (
              <>
                <Tag className="h-3.5 w-3.5" />
                {classification ? "Cambiar clasificacion" : "Clasificar cliente"}
              </>
            ) : (
              <>
                <Calendar className="h-3.5 w-3.5" />
                Agendar visita
              </>
            )}
          </button>
        )}
      </div>
    </Card>
  );
}
