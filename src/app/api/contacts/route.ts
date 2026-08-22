import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq, like, or, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const source = searchParams.get("source");

  let query = db.select().from(contacts);

  if (search) {
    query = query.where(
      or(
        like(contacts.name, `%${search}%`),
        like(contacts.phone, `%${search}%`),
        like(contacts.identificationNumber, `%${search}%`),
        like(contacts.company, `%${search}%`)
      )
    ) as typeof query;
  }

  if (source) {
    query = query.where(eq(contacts.source, source)) as typeof query;
  }

  const results = query.orderBy(desc(contacts.createdAt)).all();
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const {
    name,
    phone,
    phone2,
    address,
    city,
    neighborhood,
    identificationNumber,
    expeditionCity,
    companionName,
    motorcycleInterest,
    company,
    source,
    score,
    notes,
  } = body;

  if (!name) {
    return NextResponse.json(
      { error: "El nombre es requerido" },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    const result = db
      .insert(contacts)
      .values({
        name,
        phone: phone || null,
        phone2: phone2 || null,
        address: address || null,
        city: city || null,
        neighborhood: neighborhood || null,
        identificationNumber: identificationNumber || null,
        expeditionCity: expeditionCity || null,
        companionName: companionName || null,
        motorcycleInterest: motorcycleInterest || null,
        company: company || null,
        source: source || "otro",
        score: score || 0,
        notes: notes || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error al crear contacto: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
