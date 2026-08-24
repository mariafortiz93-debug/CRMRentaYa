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
  CheckCircle2,
} from "lucide-react";
import type {
  LeadSource,
  NextAction,
  VisitResult,
  ContactMethod,
  Classification,
} from "@/types";

/** Dias sin llamar a un aprobado antes de marcarlo en rojo. */
const MAX_DAYS_TO_CONTACT = 3;
/** Dias en "Agendar Visita" sin agendar antes de marcarlo en rojo. */
const MAX_DAYS_TO_SCHEDULE = 2;

function daysSince(ms: number | null | undefined): number | null {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 86400000);
}

function formatShortDate(ms: number): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(
    new Date(ms)
  );
}

export type CardAction =
  | "diligenciar"
  | "agendar"
  | "reprogramar"
  | "resultado"
  | "gestionar_llamada"
  | "clasificar"
  | "asistio_concesionario"
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
  /** Gestion de la llamada al aprobado. */
  approvedContactedAt?: number | null;
  approvedContactMethod?: string | null;
  procedureStartDate?: number | null;
  /** Concesionario. */
  dealershipVisitedAt?: number | null;
  /** Cuando entro a la etapa actual (alerta de dias sin agendar). */
  stageChangedAt?: number | null;
  /** Muestra el metodo de contacto (etapa Contactado). */
  showContactInfo?: boolean;
  /** Muestra el visitador asignado (etapas Visita / Visitas Reagendadas). */
  showVisitador?: boolean;
  /** Alerta si lleva demasiados dias sin agendar la visita. */
  warnIfUnscheduled?: boolean;
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
  approvedContactedAt,
  approvedContactMethod,
  procedureStartDate,
  dealershipVisitedAt,
  stageChangedAt,
  showContactInfo,
  showVisitador,
  warnIfUnscheduled,
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

  // Aprobado sin gestionar: contador de dias desde la aprobacion.
  const isApprovedColumn = primaryAction === "gestionar_llamada";
  const gestionado = !!approvedContactedAt;
  const daysSinceApproval =
    isApprovedColumn && !gestionado ? daysSince(visitResultDate) : null;
  const callOverdue =
    daysSinceApproval !== null && daysSinceApproval >= MAX_DAYS_TO_CONTACT;

  // En "Agendar Visita" sin agendar: contador de dias en la etapa.
  const daysWaiting = warnIfUnscheduled ? daysSince(stageChangedAt) : null;
  const scheduleOverdue =
    daysWaiting !== null && daysWaiting >= MAX_DAYS_TO_SCHEDULE;

  const overdue = callOverdue || scheduleOverdue;
  const methodUsedCfg = approvedContactMethod
    ? CONTACT_METHOD_CONFIG[approvedContactMethod as ContactMethod]
    : null;

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

        {(classCfg || (showContactInfo && methodCfg)) && (
          <div className="flex flex-wrap gap-1">
            {showContactInfo && methodCfg && (
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

        {daysSinceApproval !== null && (
          <div
            className={`flex items-center gap-1 text-[11px] ${
              callOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
            }`}
          >
            {callOverdue && <AlertTriangle className="h-3 w-3" />}
            {daysSinceApproval === 0
              ? "Aprobado hoy · sin gestionar"
              : `Sin gestionar hace ${daysSinceApproval} dia${daysSinceApproval === 1 ? "" : "s"}`}
            {callOverdue ? " · llamar ya" : ""}
          </div>
        )}

        {isApprovedColumn && gestionado && (
          <div className="text-[11px] space-y-0.5">
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium bg-green-100 text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Gestionado
              {methodUsedCfg ? ` ${methodUsedCfg.label.toLowerCase()}` : ""}
            </span>
            {procedureStartDate && (
              <div className="text-muted-foreground">
                Inicia tramite: {formatShortDate(procedureStartDate)}
              </div>
            )}
          </div>
        )}

        {daysWaiting !== null && (
          <div
            className={`flex items-center gap-1 text-[11px] ${
              scheduleOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
            }`}
          >
            {scheduleOverdue && <AlertTriangle className="h-3 w-3" />}
            {daysWaiting === 0
              ? "Ingreso hoy"
              : `Esperando agenda hace ${daysWaiting} dia${daysWaiting === 1 ? "" : "s"}`}
            {scheduleOverdue ? " · agendar ya" : ""}
          </div>
        )}

        {dealershipVisitedAt && (
          <div className="flex items-center gap-1 text-[11px] text-green-700 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Asistio al concesionario
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
            ) : primaryAction === "gestionar_llamada" ? (
              <>
                <Phone className="h-3.5 w-3.5" />
                {gestionado ? "Editar gestion" : "Registrar llamada"}
              </>
            ) : primaryAction === "clasificar" ? (
              <>
                <Tag className="h-3.5 w-3.5" />
                {classification ? "Cambiar clasificacion" : "Clasificar cliente"}
              </>
            ) : primaryAction === "asistio_concesionario" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {dealershipVisitedAt ? "Asistencia registrada" : "Marcar asistencia"}
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
