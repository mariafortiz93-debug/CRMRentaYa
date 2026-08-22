"use client";

import { useState, useCallback, useRef } from "react";
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
import { toast } from "sonner";
import type { PipelineColumn } from "@/types";

interface KanbanBoardProps {
  initialColumns: PipelineColumn[];
}

export function KanbanBoard({ initialColumns }: KanbanBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ contactId: string; stageId: string } | null>(
    null
  );
  const columnsSnapshot = useRef<PipelineColumn[]>(initialColumns);

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
    </DndContext>
  );
}
