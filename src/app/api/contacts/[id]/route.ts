import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  contacts,
  deals,
  activities,
  visits,
  managementLogs,
  pipelineStages,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { describeChanges, logAction } from "@/lib/audit";

/** Nombres legibles de los campos, para describir que se edito. */
const CONTACT_FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  phone: "Telefono",
  phone2: "Telefono 2",
  address: "Direccion",
  city: "Ciudad",
  neighborhood: "Barrio",
  identificationNumber: "Cedula",
  expeditionCity: "Ciudad de expedicion",
  companionName: "Acompanante",
  motorcycleInterest: "Moto de interes",
  company: "Empresa",
  source: "Fuente",
  notes: "Notas",
  contactMethod: "Medio de contacto",
  plan: "Plan",
  classification: "Clasificacion",
  classificationDetail: "Detalle de clasificacion",
  visitResult: "Estado de la visita",
  visitResultNote: "Motivo del estado",
  procedureStartDate: "Fecha de inicio de tramite",
  approvedContactMethod: "Gestion del aprobado",
};

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
  const auth = await requirePermission("contactos_editar", request);
  if (!auth.ok) return auth.error;

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
  if (body.stageId !== undefined) {
    updateData.stageId = body.stageId;
    // Marca de tiempo de entrada a la etapa, para las alertas por dias sin gestion.
    if (body.stageId !== existing.stageId) updateData.stageChangedAt = new Date();
  }
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
  if (body.contactMethod !== undefined) updateData.contactMethod = body.contactMethod;
  if (body.plan !== undefined) updateData.plan = body.plan;
  if (body.classification !== undefined) {
    updateData.classification = body.classification;
    updateData.classificationDate = body.classification ? new Date() : null;
  }
  if (body.classificationDetail !== undefined)
    updateData.classificationDetail = body.classificationDetail;
  if (body.visitResult !== undefined) {
    updateData.visitResult = body.visitResult;
    // Registrar la fecha del resultado para el contador de dias.
    updateData.visitResultDate = body.visitResult ? new Date() : null;
  }
  if (body.visitResultNote !== undefined)
    updateData.visitResultNote = body.visitResultNote;
  if (body.procedureStartDate !== undefined)
    updateData.procedureStartDate = body.procedureStartDate
      ? new Date(body.procedureStartDate)
      : null;
  // Gestion de la llamada al cliente aprobado.
  if (body.approvedContactMethod !== undefined) {
    updateData.approvedContactMethod = body.approvedContactMethod;
    updateData.approvedContactedAt = body.approvedContactMethod ? new Date() : null;
  }
  if (body.dealershipVisited !== undefined)
    updateData.dealershipVisitedAt = body.dealershipVisited ? new Date() : null;

  const result = db
    .update(contacts)
    .set(updateData)
    .where(eq(contacts.id, id))
    .returning()
    .get();

  // El cambio de etapa se describe aparte, con el nombre de la etapa y no el id.
  const movedStage =
    updateData.stageId !== undefined && updateData.stageId !== existing.stageId;
  if (movedStage) {
    const stage = db
      .select({ name: pipelineStages.name })
      .from(pipelineStages)
      .where(eq(pipelineStages.id, String(updateData.stageId)))
      .get();
    logAction(auth.user, {
      action: "mover",
      entity: "contacto",
      entityId: result.id,
      entityLabel: result.name,
      detail: `Lo paso a "${stage?.name || "otra etapa"}"`,
    });
  }

  const detail = describeChanges(existing, updateData, CONTACT_FIELD_LABELS);
  if (detail !== "Sin cambios") {
    logAction(auth.user, {
      action: "editar",
      entity: "contacto",
      entityId: result.id,
      entityLabel: result.name,
      detail,
    });
  }

  return NextResponse.json(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("contactos_eliminar", request);
  if (!auth.ok) return auth.error;

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

  // Borrar primero todo lo que referencia al contacto (claves foraneas).
  db.delete(activities).where(eq(activities.contactId, id)).run();
  db.delete(managementLogs).where(eq(managementLogs.contactId, id)).run();
  db.delete(visits).where(eq(visits.contactId, id)).run();
  db.delete(deals).where(eq(deals.contactId, id)).run();
  db.delete(contacts).where(eq(contacts.id, id)).run();

  // `audit_logs` no referencia a `contacts`, asi que el historial de este
  // cliente sigue en Registros aunque el contacto ya no exista.
  logAction(auth.user, {
    action: "eliminar",
    entity: "contacto",
    entityId: id,
    entityLabel: existing.name,
    detail: `Elimino el cliente y todo su historial${
      existing.phone ? ` (tel. ${existing.phone})` : ""
    }`,
  });

  return NextResponse.json({ success: true });
}
