"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { ContactCard } from "./ContactCard";
import { ContactMethodDialog } from "./ContactMethodDialog";
import { ScheduleVisitDialog } from "./ScheduleVisitDialog";
import { VisitResultDialog } from "./VisitResultDialog";
import { ContactForm } from "@/components/contacts/ContactForm";
import { toast } from "sonner";
import type { PipelineColumn, Contact } from "@/types";

interface KanbanBoardProps {
  initialColumns: PipelineColumn[];
}

type PrimaryAction = "diligenciar" | "agendar" | "reprogramar" | "resultado" | null;

function stagePrimaryAction(name: string): PrimaryAction {
  const n = name.toLowerCase();
  if (n === "registro online") return "diligenciar";
  if (n === "agendar visita" || n === "visitas reagendadas") return "agendar";
  if (n === "visita") return "reprogramar";
  if (n === "estado de la visita") return "resultado";
  return null;
}

export function KanbanBoard({ initialColumns }: KanbanBoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ contactId: string; stageId: string } | null>(
    null
  );
  const [diligenciarContact, setDiligenciarContact] = useState<Contact | null>(null);
  const [agendarContact, setAgendarContact] = useState<Contact | null>(null);
  const [resultContact, setResultContact] = useState<Contact | null>(null);
  const columnsSnapshot = useRef<PipelineColumn[]>(initialColumns);

  const agendarStageId =
    columns.find((c) => c.name.toLowerCase() === "agendar visita")?.id ?? null;

  const moveContactLocal = (contactId: string, toStageName: string) => {
    setColumns((prev) => {
      const target = prev.find((c) => c.name.toLowerCase() === toStageName.toLowerCase());
      if (!target) return prev;
      const contact = prev.flatMap((c) => c.contacts).find((c) => c.id === contactId);
      if (!contact) return prev;
      return prev.map((col) => {
        if (col.contacts.some((c) => c.id === contactId)) {
          return { ...col, contacts: col.contacts.filter((c) => c.id !== contactId) };
        }
        if (col.id === target.id) {
          return { ...col, contacts: [...col.contacts, { ...contact, stageId: target.id }] };
        }
        return col;
      });
    });
  };

  const handleCardAction = (contactId: string) => {
    const contact = columns.flatMap((c) => c.contacts).find((c) => c.id === contactId);
    if (!contact) return;
    const column = columns.find((c) => c.contacts.some((x) => x.id === contactId));
    const action = column ? stagePrimaryAction(column.name) : null;
    if (action === "diligenciar") setDiligenciarContact(contact);
    else if (action === "agendar" || action === "reprogramar") setAgendarContact(contact);
    else if (action === "resultado") setResultContact(contact);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const activeContact = activeId
    ? columns
        .flatMap((col) => col.contacts)
        .find((c) => c.id === activeId)
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    columnsSnapshot.current = columns;
  }, [columns]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which columns the items are in
    const activeColumn = columns.find((col) =>
      col.contacts.some((c) => c.id === activeId)
    );
    const overColumn =
      columns.find((col) => col.id === overId) ||
      columns.find((col) => col.contacts.some((c) => c.id === overId));

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id)
      return;

    setColumns((prev) => {
      const activeContact = activeColumn.contacts.find((c) => c.id === activeId);
      if (!activeContact) return prev;

      return prev.map((col) => {
        if (col.id === activeColumn.id) {
          return {
            ...col,
            contacts: col.contacts.filter((c) => c.id !== activeId),
          };
        }
        if (col.id === overColumn.id) {
          return {
            ...col,
            contacts: [...col.contacts, { ...activeContact, stageId: col.id }],
          };
        }
        return col;
      });
    });
  }, [columns]);

  const commitMove = useCallback(
    async (contactId: string, stageId: string, contactMethod?: "whatsapp" | "call") => {
      try {
        const res = await fetch("/api/pipeline", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId, stageId }),
        });
        if (!res.ok) throw new Error("API error");

        if (contactMethod) {
          await fetch("/api/activities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "call",
              description:
                contactMethod === "whatsapp"
                  ? "Contacto inicial via WhatsApp"
                  : "Contacto inicial via llamada telefonica",
              contactId,
            }),
          });
        }
      } catch {
        // Rollback to pre-drag state
        setColumns(columnsSnapshot.current);
        toast.error("Error al mover el contacto. Se revirtio el cambio.");
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overColumn =
        columns.find((col) => col.id === over.id) ||
        columns.find((col) => col.contacts.some((c) => c.id === over.id));

      if (!overColumn) return;

      if (overColumn.name.toLowerCase() === "contactado") {
        setPendingMove({ contactId: activeId, stageId: overColumn.id });
        return;
      }

      commitMove(activeId, overColumn.id);
    },
    [columns, commitMove]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            name={column.name}
            color={column.color}
            nextAction={column.nextAction}
            primaryAction={stagePrimaryAction(column.name)}
            onCardAction={handleCardAction}
            contacts={column.contacts.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              source: c.source,
            }))}
          />
        ))}
      </div>

      <DragOverlay>
        {activeContact ? (
          <ContactCard
            id={activeContact.id}
            name={activeContact.name}
            phone={activeContact.phone}
            source={activeContact.source}
            nextAction={
              columns.find((col) => col.id === activeContact.stageId)?.nextAction ?? null
            }
          />
        ) : null}
      </DragOverlay>

      <ContactMethodDialog
        open={!!pendingMove}
        onClose={() => {
          setColumns(columnsSnapshot.current);
          setPendingMove(null);
        }}
        onSelect={(method) => {
          const move = pendingMove;
          setPendingMove(null);
          if (move) commitMove(move.contactId, move.stageId, method);
        }}
      />

      {diligenciarContact && (
        <ContactForm
          open={!!diligenciarContact}
          advanceToStageId={agendarStageId}
          onSaved={() => moveContactLocal(diligenciarContact.id, "Agendar Visita")}
          onClose={() => {
            setDiligenciarContact(null);
            router.refresh();
          }}
          initialData={{
            id: diligenciarContact.id,
            name: diligenciarContact.name,
            phone: diligenciarContact.phone || "",
            phone2: diligenciarContact.phone2 || "",
            address: diligenciarContact.address || "",
            city: diligenciarContact.city || "",
            neighborhood: diligenciarContact.neighborhood || "",
            identificationNumber: diligenciarContact.identificationNumber || "",
            expeditionCity: diligenciarContact.expeditionCity || "",
            companionName: diligenciarContact.companionName || "",
            motorcycleInterest: diligenciarContact.motorcycleInterest || "boxer_ct100_ks",
            company: diligenciarContact.company || "",
            source: diligenciarContact.source,
            notes: diligenciarContact.notes || "",
          }}
        />
      )}

      {agendarContact && (
        <ScheduleVisitDialog
          open={!!agendarContact}
          contactId={agendarContact.id}
          contactNeighborhood={agendarContact.neighborhood}
          onScheduled={() => moveContactLocal(agendarContact.id, "Visita")}
          onClose={() => {
            setAgendarContact(null);
            router.refresh();
          }}
        />
      )}

      {resultContact && (
        <VisitResultDialog
          open={!!resultContact}
          contactId={resultContact.id}
          currentResult={resultContact.visitResult}
          currentNote={resultContact.visitResultNote}
          onClose={() => {
            setResultContact(null);
            router.refresh();
          }}
        />
      )}
    </DndContext>
  );
}
