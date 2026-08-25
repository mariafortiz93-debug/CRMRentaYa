"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ContactCard, type CardAction } from "./ContactCard";
import type { NextAction } from "@/types";

interface ContactCardData {
  id: string;
  name: string;
  phone: string | null;
  source: string;
  primaryAction: CardAction;
  visitResult: string | null;
  visitResultDate: number | null;
  contactMethod: string | null;
  plan: string | null;
  classification: string | null;
  classificationDetail: string | null;
  visitador: string | null;
  managementCount: number;
  lastManagementOutcome: string | null;
  lastManagementMethod: string | null;
  approvedContactedAt: number | null;
  approvedContactMethod: string | null;
  procedureStartDate: number | null;
  dealershipVisitedAt: number | null;
  stageChangedAt: number | null;
}

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  nextAction: NextAction | null;
  onCardAction?: (contactId: string) => void;
  onStartProcedure?: (contactId: string) => void;
  contacts: ContactCardData[];
  /** Columna calculada: no acepta drop y sus tarjetas no se arrastran. */
  virtual?: boolean;
  showVisitador?: boolean;
  warnIfUnscheduled?: boolean;
}

export function KanbanColumn({
  id,
  name,
  color,
  nextAction,
  onCardAction,
  onStartProcedure,
  contacts,
  virtual,
  showVisitador,
  warnIfUnscheduled,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: virtual });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] rounded-lg transition-colors ${
        virtual ? "bg-green-50/60 border border-dashed border-green-300" : "bg-muted/50"
      } ${isOver && !virtual ? "bg-muted" : ""}`}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-semibold flex-1 truncate">{name}</h3>
        <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
          {contacts.length}
        </span>
      </div>

      {virtual && (
        <p className="px-3 pt-2 text-[11px] text-muted-foreground">
          Aprobados pendientes de llamar para iniciar tramite.
        </p>
      )}

      <SortableContext
        items={contacts.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-2 space-y-2 min-h-[100px] overflow-y-auto">
          {contacts.map((contact) => (
            <ContactCard
              key={virtual ? `virtual-${contact.id}` : contact.id}
              id={contact.id}
              name={contact.name}
              phone={contact.phone}
              source={contact.source}
              nextAction={nextAction}
              primaryAction={contact.primaryAction}
              visitResult={contact.visitResult}
              visitResultDate={contact.visitResultDate}
              plan={contact.plan}
              classification={contact.classification}
              classificationDetail={contact.classificationDetail}
              visitador={contact.visitador}
              managementCount={contact.managementCount}
              lastManagementOutcome={contact.lastManagementOutcome}
              lastManagementMethod={contact.lastManagementMethod}
              approvedContactedAt={contact.approvedContactedAt}
              procedureStartDate={contact.procedureStartDate}
              dealershipVisitedAt={contact.dealershipVisitedAt}
              stageChangedAt={contact.stageChangedAt}
              showVisitador={showVisitador}
              warnIfUnscheduled={warnIfUnscheduled}
              draggable={!virtual}
              onPrimaryAction={
                onCardAction ? () => onCardAction(contact.id) : undefined
              }
              onStartProcedure={
                onStartProcedure ? () => onStartProcedure(contact.id) : undefined
              }
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
