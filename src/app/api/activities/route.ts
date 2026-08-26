import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { activities, contacts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/constants";
import type { ActivityType } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");
  const dealId = searchParams.get("dealId");

  let query = db
    .select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      contactId: activities.contactId,
      dealId: activities.dealId,
      scheduledAt: activities.scheduledAt,
      completedAt: activities.completedAt,
      createdAt: activities.createdAt,
      contactName: contacts.name,
    })
    .from(activities)
    .leftJoin(contacts, eq(activities.contactId, contacts.id));

  if (contactId) {
    query = query.where(eq(activities.contactId, contactId)) as typeof query;
  }

  if (dealId) {
    query = query.where(eq(activities.dealId, dealId)) as typeof query;
  }

  const results = (await query.orderBy(desc(activities.createdAt)));
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("actividades", request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const { type, description, contactId, dealId, scheduledAt } = body;

  if (!type || !description || !contactId) {
    return NextResponse.json(
      { error: "Tipo, descripcion y contacto son requeridos" },
      { status: 400 }
    );
  }

  try {
    const result = (await oneOrFail(db
      .insert(activities)
      .values({
        type,
        description,
        contactId,
        dealId: dealId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        completedAt: null,
        createdAt: new Date(),
      })
      .returning()
      ));

    const contact = (await one(db
      .select({ name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      ));

    logAction(auth.user, {
      action: "crear",
      entity: "actividad",
      entityId: result.id,
      entityLabel: contact?.name || null,
      detail: `${
        ACTIVITY_TYPE_CONFIG[type as ActivityType]?.label || type
      }: ${description}`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return NextResponse.json(
      { error: `Error al crear actividad: ${msg}` },
      { status: 500 }
    );
  }
}
