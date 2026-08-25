import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { visits, contacts, pipelineStages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";

/** "lunes, 3 de septiembre, 10:00 a. m." para el detalle del historial. */
function formatVisitDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function GET() {
  const rows = db
    .select({
      id: visits.id,
      contactId: visits.contactId,
      visitador: visits.visitador,
      neighborhood: visits.neighborhood,
      scheduledAt: visits.scheduledAt,
      createdAt: visits.createdAt,
      contactName: contacts.name,
      contactPhone: contacts.phone,
    })
    .from(visits)
    .leftJoin(contacts, eq(visits.contactId, contacts.id))
    .orderBy(asc(visits.scheduledAt))
    .all();

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("agenda_editar", request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { contactId, visitador, scheduledAt, neighborhood } = body;

  if (!contactId || !visitador || !scheduledAt) {
    return NextResponse.json(
      { error: "contactId, visitador y scheduledAt son requeridos" },
      { status: 400 }
    );
  }

  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!contact) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  try {
    const now = new Date();
    const visit = db
      .insert(visits)
      .values({
        contactId,
        visitador,
        neighborhood: neighborhood || contact.neighborhood || null,
        scheduledAt: new Date(scheduledAt),
        createdAt: now,
      })
      .returning()
      .get();

    // Move the contact to the "Visita" stage automatically.
    const visitaStage = db
      .select()
      .from(pipelineStages)
      .all()
      .find((s) => s.name.toLowerCase() === "visita");

    if (visitaStage) {
      db.update(contacts)
        .set({ stageId: visitaStage.id, updatedAt: now })
        .where(eq(contacts.id, contactId))
        .run();
    }

    logAction(auth.user, {
      action: "agendar",
      entity: "visita",
      entityId: visit.id,
      entityLabel: contact.name,
      detail: `Visita con ${visit.visitador} el ${formatVisitDate(
        visit.scheduledAt
      )}${visit.neighborhood ? ` en ${visit.neighborhood}` : ""}`,
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error al agendar: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
