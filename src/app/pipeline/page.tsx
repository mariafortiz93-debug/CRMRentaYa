import { Suspense } from "react";
import { db } from "@/db";
import { pipelineStages, contacts, visits, managementLogs } from "@/db/schema";
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

  const stages = (await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order))
    );

  const allContacts = (await db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt))
    );

  const allVisits = (await db
    .select()
    .from(visits)
    .orderBy(desc(visits.scheduledAt))
    );

  // Visita mas reciente por contacto, para mostrar el visitador en la tarjeta.
  const latestVisit = new Map<string, (typeof allVisits)[number]>();
  for (const v of allVisits) {
    if (!latestVisit.has(v.contactId)) latestVisit.set(v.contactId, v);
  }

  // Resumen de gestiones: cuantas y cual fue la ultima.
  const allLogs = (await db
    .select()
    .from(managementLogs)
    .orderBy(desc(managementLogs.createdAt))
    );

  const logSummary = new Map<
    string,
    { count: number; outcome: string; method: string }
  >();
  for (const log of allLogs) {
    const entry = logSummary.get(log.contactId);
    if (entry) {
      entry.count++;
    } else {
      // El primero que llega es el mas reciente (van ordenados desc).
      logSummary.set(log.contactId, {
        count: 1,
        outcome: log.outcome,
        method: log.method,
      });
    }
  }

  const visible: PipelineContact[] = allContacts
    .filter((c) => inRange(c.createdAt, range))
    .map((c) => {
      const v = latestVisit.get(c.id);
      const g = logSummary.get(c.id);
      return {
        ...c,
        visitador: v?.visitador ?? null,
        visitScheduledAt: v?.scheduledAt ?? null,
        managementCount: g?.count ?? 0,
        lastManagementOutcome: g?.outcome ?? null,
        lastManagementMethod: g?.method ?? null,
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
        // Todos los aprobados de la etapa anterior: gestionados y sin gestionar.
        // Los sin gestionar van primero para que salten a la vista.
        contacts: visible
          .filter((c) => c.stageId === estadoStage.id && c.visitResult === "aprobado")
          .sort((a, b) => {
            const aDone = a.approvedContactedAt ? 1 : 0;
            const bDone = b.approvedContactedAt ? 1 : 0;
            return aDone - bDone;
          }),
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
