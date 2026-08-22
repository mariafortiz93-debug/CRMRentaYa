import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pipelineStages, contacts } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export async function GET() {
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

  const pipeline = stages.map((stage) => ({
    ...stage,
    contacts: allContacts.filter((c) => c.stageId === stage.id),
  }));

  return NextResponse.json(pipeline);
}

export async function PUT(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // Move a contact to another stage (drag and drop)
  if (body.contactId && body.stageId) {
    const existing = db.select().from(contacts).where(eq(contacts.id, body.contactId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    const result = db
      .update(contacts)
      .set({ stageId: body.stageId, updatedAt: new Date() })
      .where(eq(contacts.id, body.contactId))
      .returning()
      .get();

    return NextResponse.json(result);
  }

  // Bulk update stages (from /setup or /customize)
  if (body.stages && Array.isArray(body.stages)) {
    // Delete existing stages (only if no contacts reference them)
    const existingContacts = db.select().from(contacts).all();
    if (existingContacts.length > 0) {
      return NextResponse.json(
        {
          error:
            "No se pueden reemplazar etapas cuando hay contactos activos. Elimina los contactos primero.",
        },
        { status: 400 }
      );
    }

    db.delete(pipelineStages).run();

    for (const stage of body.stages) {
      db.insert(pipelineStages)
        .values({
          name: stage.name,
          order: stage.order,
          color: stage.color || "#64748b",
          isWon: stage.isWon || false,
          isLost: stage.isLost || false,
          nextAction: stage.nextAction || null,
        })
        .run();
    }

    const updated = db
      .select()
      .from(pipelineStages)
      .orderBy(asc(pipelineStages.order))
      .all();

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Request invalido" }, { status: 400 });
}
