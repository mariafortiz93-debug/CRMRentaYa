import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { pipelineStages, contacts } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";

export async function GET() {
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

  const pipeline = stages.map((stage) => ({
    ...stage,
    contacts: allContacts.filter((c) => c.stageId === stage.id),
  }));

  return NextResponse.json(pipeline);
}

export async function PUT(request: NextRequest) {
  const auth = await requirePermission("pipeline_mover", request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // Move a contact to another stage (drag and drop)
  if (body.contactId && body.stageId) {
    const existing = (await one(db.select().from(contacts).where(eq(contacts.id, body.contactId))));
    if (!existing) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    const now = new Date();
    const changed = existing.stageId !== body.stageId;

    // Al entrar a "Visita al Concesionario" se registra que el cliente anuncio
    // que iria; sirve para medir cuantos de esos efectivamente asistieron.
    const target = (await one(db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, body.stageId))
      ));
    const entersDealership =
      changed && target?.name.toLowerCase() === "visita al concesionario";

    const result = (await oneOrFail(db
      .update(contacts)
      .set({
        stageId: body.stageId,
        updatedAt: now,
        ...(changed ? { stageChangedAt: now } : {}),
        ...(entersDealership && !existing.dealershipAnnouncedAt
          ? { dealershipAnnouncedAt: now }
          : {}),
      })
      .where(eq(contacts.id, body.contactId))
      .returning()
      ));

    if (changed) {
      const origin = (await one(db
        .select({ name: pipelineStages.name })
        .from(pipelineStages)
        .where(eq(pipelineStages.id, existing.stageId || ""))
        ));
      logAction(auth.user, {
        action: "mover",
        entity: "contacto",
        entityId: result.id,
        entityLabel: result.name,
        detail: `De "${origin?.name || "sin etapa"}" a "${
          target?.name || "otra etapa"
        }"`,
      });
    }

    return NextResponse.json(result);
  }

  // Bulk update stages (from /setup or /customize)
  if (body.stages && Array.isArray(body.stages)) {
    // Rehacer el pipeline entero cambia el flujo comercial de todo el equipo:
    // solo el super administrador.
    if (auth.user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo el super administrador puede cambiar las etapas" },
        { status: 403 }
      );
    }

    // Delete existing stages (only if no contacts reference them)
    const existingContacts = (await db.select().from(contacts));
    if (existingContacts.length > 0) {
      return NextResponse.json(
        {
          error:
            "No se pueden reemplazar etapas cuando hay contactos activos. Elimina los contactos primero.",
        },
        { status: 400 }
      );
    }

    (await db.delete(pipelineStages));

    for (const stage of body.stages) {
      (await db.insert(pipelineStages)
        .values({
          name: stage.name,
          order: stage.order,
          color: stage.color || "#64748b",
          isWon: stage.isWon || false,
          isLost: stage.isLost || false,
          nextAction: stage.nextAction || null,
        })
        );
    }

    const updated = (await db
      .select()
      .from(pipelineStages)
      .orderBy(asc(pipelineStages.order))
      );

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Request invalido" }, { status: 400 });
}
