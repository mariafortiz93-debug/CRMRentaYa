"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ContactCard } from "./ContactCard";
import type { NextAction } from "@/types";

interface ContactCardData {
  id: string;
  name: string;
  phone: string | null;
  source: string;
}

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  nextAction: NextAction | null;
  contacts: ContactCardData[];
}

export function KanbanColumn({ id, name, color, nextAction, contacts }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] rounded-lg bg-muted/50 transition-colors ${
        isOver ? "bg-muted" : ""
      }`}
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

      <SortableContext
        items={contacts.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-2 space-y-2 min-h-[100px] overflow-y-auto">
          {contacts.map((contact) => (
            <ContactCard key={contact.id} {...contact} nextAction={nextAction} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
