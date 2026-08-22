import { db } from "@/db";
import { pipelineStages, contacts } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import type { PipelineColumn } from "@/types";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  const stages = db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order))
    .all();

  const allContacts = db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt))
    .all();

  const columns: PipelineColumn[] = stages.map((stage) => ({
    ...stage,
    contacts: allContacts.filter((c) => c.stageId === stage.id),
  })) as PipelineColumn[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground">
          Arrastra y suelta contactos entre etapas
        </p>
      </div>

      <KanbanBoard initialColumns={columns} />
    </div>
  );
}
