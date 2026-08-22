import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, deals, activities } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const contact = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();

  if (!contact) {
    return NextResponse.json(
      { error: "Contacto no encontrado" },
      { status: 404 }
    );
  }

  const contactDeals = db
    .select()
    .from(deals)
    .where(eq(deals.contactId, id))
    .all();

  const contactActivities = db
    .select()
    .from(activities)
    .where(eq(activities.contactId, id))
    .all();

  return NextResponse.json({
    ...contact,
    deals: contactDeals,
    activities: contactActivities,
  });
}

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

  const existing = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();

  if (!existing) {
    return NextResponse.json(
      { error: "Contacto no encontrado" },
      { status: 404 }
    );
  }

  // Only allow updating specific fields
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.stageId !== undefined) updateData.stageId = body.stageId;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.phone2 !== undefined) updateData.phone2 = body.phone2;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.city !== undefined) updateData.city = body.city;
  if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
  if (body.identificationNumber !== undefined)
    updateData.identificationNumber = body.identificationNumber;
  if (body.expeditionCity !== undefined) updateData.expeditionCity = body.expeditionCity;
  if (body.companionName !== undefined) updateData.companionName = body.companionName;
  if (body.motorcycleInterest !== undefined)
    updateData.motorcycleInterest = body.motorcycleInterest;
  if (body.company !== undefined) updateData.company = body.company;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.score !== undefined) updateData.score = Math.max(0, Math.min(100, body.score));
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.visitResult !== undefined) updateData.visitResult = body.visitResult;
  if (body.procedureStartDate !== undefined)
    updateData.procedureStartDate = body.procedureStartDate
      ? new Date(body.procedureStartDate)
      : null;

  const result = db
    .update(contacts)
    .set(updateData)
    .where(eq(contacts.id, id))
    .returning()
    .get();

  return NextResponse.json(result);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();

  if (!existing) {
    return NextResponse.json(
      { error: "Contacto no encontrado" },
      { status: 404 }
    );
  }

  db.delete(activities).where(eq(activities.contactId, id)).run();
  db.delete(deals).where(eq(deals.contactId, id)).run();
  db.delete(contacts).where(eq(contacts.id, id)).run();
  return NextResponse.json({ success: true });
}
