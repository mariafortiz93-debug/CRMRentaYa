import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { visits, contacts, pipelineStages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = db.select().from(visits).where(eq(visits.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.visitador !== undefined) updateData.visitador = body.visitador;
  if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
  if (body.scheduledAt !== undefined) updateData.scheduledAt = new Date(body.scheduledAt);

  const result = db
    .update(visits)
    .set(updateData)
    .where(eq(visits.id, id))
    .returning()
    .get();

  // Al reprogramar, dejar el contacto en la etapa "Visita".
  const visitaStage = db
    .select()
    .from(pipelineStages)
    .all()
    .find((s) => s.name.toLowerCase() === "visita");
  if (visitaStage) {
    db.update(contacts)
      .set({ stageId: visitaStage.id, updatedAt: new Date() })
      .where(eq(contacts.id, existing.contactId))
      .run();
  }

  return NextResponse.json(result);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.delete(visits).where(eq(visits.id, id)).run();
  return NextResponse.json({ success: true });
}
