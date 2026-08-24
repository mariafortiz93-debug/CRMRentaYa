import { Suspense } from "react";
import { db } from "@/db";
import { pipelineStages, contacts, visits } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { VisitStatesButton } from "@/components/pipeline/VisitStatesButton";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { resolveDateRange, inRange } from "@/lib/dateRange";
import type { PipelineColumn, PipelineContact } from "@/types";

export const dynamic = "force-dynamic";

/** Columna calculada: los aprobados pendientes de llamar para iniciar tramite. */
export const APPROVED_COLUMN_ID = "virtual-clientes-aprobados";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);

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

  const allVisits = db
    .select()
    .from(visits)
    .orderBy(desc(visits.scheduledAt))
    .all();

  // Visita mas reciente por contacto, para mostrar el visitador en la tarjeta.
  const latestVisit = new Map<string, (typeof allVisits)[number]>();
  for (const v of allVisits) {
    if (!latestVisit.has(v.contactId)) latestVisit.set(v.contactId, v);
  }

  const visible: PipelineContact[] = allContacts
    .filter((c) => inRange(c.createdAt, range))
    .map((c) => {
      const v = latestVisit.get(c.id);
      return {
        ...c,
        visitador: v?.visitador ?? null,
        visitScheduledAt: v?.scheduledAt ?? null,
      } as PipelineContact;
    });

  const estadoStage = stages.find(
    (s) => s.name.toLowerCase() === "estado de la visita"
  );

  const columns: PipelineColumn[] = [];
  for (const stage of stages) {
    columns.push({
      ...stage,
      contacts: visible.filter((c) => c.stageId === stage.id),
    } as PipelineColumn);

    // Justo despues de "Estado de la Visita" va la columna de aprobados.
    if (estadoStage && stage.id === estadoStage.id) {
      columns.push({
        id: APPROVED_COLUMN_ID,
        name: "Clientes Aprobados",
        order: stage.order,
        color: "#16a34a",
        isWon: false,
        isLost: false,
        nextAction: "call",
        virtual: true,
        contacts: visible.filter(
          (c) =>
            c.stageId === estadoStage.id &&
            c.visitResult === "aprobado" &&
            !c.procedureStartDate
        ),
      } as PipelineColumn);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">
            Arrastra y suelta contactos entre etapas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <DateRangeFilter
              from={range.fromParam}
              to={range.toParam}
              hint="Leads creados"
            />
          </Suspense>
          <VisitStatesButton from={range.fromParam} to={range.toParam} />
        </div>
      </div>

      <KanbanBoard initialColumns={columns} />
    </div>
  );
}
