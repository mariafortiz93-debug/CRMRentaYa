import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { visits, contacts, pipelineStages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";

/** "3 sept 2026, 10:00 a. m." para el detalle del historial. */
function formatVisitDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("agenda_editar", request);
  if (!auth.ok) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = (await one(db.select().from(visits).where(eq(visits.id, id))));
  if (!existing) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.visitador !== undefined) updateData.visitador = body.visitador;
  if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
  if (body.scheduledAt !== undefined) updateData.scheduledAt = new Date(body.scheduledAt);

  const result = (await oneOrFail(db
    .update(visits)
    .set(updateData)
    .where(eq(visits.id, id))
    .returning()
    ));

  // Al reprogramar, dejar el contacto en la etapa "Visita".
  const visitaStage = (await db
    .select()
    .from(pipelineStages)
    )
    .find((s) => s.name.toLowerCase() === "visita");
  if (visitaStage) {
    (await db.update(contacts)
      .set({ stageId: visitaStage.id, updatedAt: new Date() })
      .where(eq(contacts.id, existing.contactId))
      );
  }

  const contact = (await one(db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, existing.contactId))
    ));

  const cambios: string[] = [];
  if (result.visitador !== existing.visitador) {
    cambios.push(`visitador: ${result.visitador}`);
  }
  if (result.scheduledAt.getTime() !== existing.scheduledAt.getTime()) {
    cambios.push(`fecha: ${formatVisitDate(result.scheduledAt)}`);
  }
  if (result.neighborhood !== existing.neighborhood) {
    cambios.push(`barrio: ${result.neighborhood || "(vacio)"}`);
  }

  if (cambios.length > 0) {
    logAction(auth.user, {
      action: "agendar",
      entity: "visita",
      entityId: result.id,
      entityLabel: contact?.name || null,
      detail: `Reprogramo la visita · ${cambios.join(" · ")}`,
    });
  }

  return NextResponse.json(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("agenda_editar", request);
  if (!auth.ok) return auth.error;

  const { id } = await params;

  const existing = (await one(db.select().from(visits).where(eq(visits.id, id))));
  if (!existing) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const contact = (await one(db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, existing.contactId))
    ));

  (await db.delete(visits).where(eq(visits.id, id)));

  logAction(auth.user, {
    action: "eliminar",
    entity: "visita",
    entityId: id,
    entityLabel: contact?.name || null,
    detail: `Cancelo la visita del ${formatVisitDate(existing.scheduledAt)} con ${
      existing.visitador
    }`,
  });

  return NextResponse.json({ success: true });
}
