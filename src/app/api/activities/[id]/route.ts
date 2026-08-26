import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { activities, contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";

/** Nombre del cliente al que pertenece la actividad, para el historial. */
async function contactName(contactId: string): Promise<string | null> {
  const row = (await one(db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    ));
  return row?.name || null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("actividades", request);
  if (!auth.ok) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const existing = (await one(db
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      ));

    if (!existing) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.completedAt !== undefined) {
      if (body.completedAt === null || body.completedAt === true) {
        updateData.completedAt = new Date();
      } else if (typeof body.completedAt === "string") {
        const parsed = new Date(body.completedAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "completedAt debe ser una fecha valida" },
            { status: 400 }
          );
        }
        updateData.completedAt = parsed;
      }
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string" || !body.description.trim()) {
        return NextResponse.json(
          { error: "description debe ser un texto no vacio" },
          { status: 400 }
        );
      }
      updateData.description = body.description;
    }

    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null) {
        updateData.scheduledAt = null;
      } else if (typeof body.scheduledAt === "string") {
        const parsed = new Date(body.scheduledAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "scheduledAt debe ser una fecha valida" },
            { status: 400 }
          );
        }
        updateData.scheduledAt = parsed;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const result = (await oneOrFail(db
      .update(activities)
      .set(updateData)
      .where(eq(activities.id, id))
      .returning()
      ));

    const completada =
      updateData.completedAt !== undefined && !existing.completedAt;
    logAction(auth.user, {
      action: "editar",
      entity: "actividad",
      entityId: result.id,
      entityLabel: await contactName(result.contactId),
      detail: completada
        ? `Marco como hecha: ${result.description}`
        : `Actualizo la actividad: ${result.description}`,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Error al actualizar: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("actividades", request);
  if (!auth.ok) return auth.error;

  const { id } = await params;

  try {
    const existing = (await one(db
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      ));

    if (!existing) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      );
    }

    (await db.delete(activities).where(eq(activities.id, id)));

    logAction(auth.user, {
      action: "eliminar",
      entity: "actividad",
      entityId: id,
      entityLabel: await contactName(existing.contactId),
      detail: `Elimino la actividad: ${existing.description}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Error al eliminar: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
