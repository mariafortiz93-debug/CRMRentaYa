import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { contacts, pipelineStages } from "@/db/schema";
import { eq, like, or, desc, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { SOURCE_LABELS } from "@/lib/constants";
import type { LeadSource } from "@/types";

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

  const results = (await query.orderBy(desc(contacts.createdAt)));
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("contactos_crear", request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const {
    name,
    stageId,
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

    let resolvedStageId = stageId;
    if (!resolvedStageId) {
      const firstStage = (await one(db
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .orderBy(asc(pipelineStages.order))
        .limit(1)
        ));
      resolvedStageId = firstStage?.id || null;
    }

    const result = (await oneOrFail(db
      .insert(contacts)
      .values({
        name,
        stageId: resolvedStageId,
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
      ));

    const sourceLabel =
      SOURCE_LABELS[(result.source as LeadSource) || "otro"] || result.source;
    logAction(auth.user, {
      action: "crear",
      entity: "contacto",
      entityId: result.id,
      entityLabel: result.name,
      detail: `Registro el lead (${sourceLabel})`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error al crear contacto: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
