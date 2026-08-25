import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { managementLogs, contacts, pipelineStages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";
import {
  CONTACT_METHOD_CONFIG,
  MANAGEMENT_OUTCOME_CONFIG,
  MANAGEMENT_REASON_CONFIG,
} from "@/lib/constants";
import type {
  ContactMethod,
  ManagementOutcome,
  ManagementReason,
} from "@/types";

/** Historico de gestiones. Con ?contactId= devuelve solo las de ese cliente. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");

  const rows = contactId
    ? db
        .select()
        .from(managementLogs)
        .where(eq(managementLogs.contactId, contactId))
        .orderBy(desc(managementLogs.createdAt))
        .all()
    : db
        .select()
        .from(managementLogs)
        .orderBy(desc(managementLogs.createdAt))
        .all();

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("pipeline_mover", request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { contactId, method, outcome, promisedDate, reason, reasonDetail, note } =
    body;

  if (!contactId || !method || !outcome) {
    return NextResponse.json(
      { error: "contactId, method y outcome son requeridos" },
      { status: 400 }
    );
  }

  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!contact) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  try {
    const now = new Date();
    const log = db
      .insert(managementLogs)
      .values({
        contactId,
        method,
        outcome,
        promisedDate: promisedDate ? new Date(promisedDate) : null,
        reason: reason || null,
        reasonDetail: reasonDetail || null,
        note: note || null,
        createdAt: now,
      })
      .returning()
      .get();

    // Si el cliente desistio, sale del embudo y pasa a Perdido.
    const perdidoStage =
      reason === "desistio"
        ? db
            .select()
            .from(pipelineStages)
            .all()
            .find((s) => s.isLost)
        : null;

    // El contacto guarda un resumen de la ultima gestion, para pintarlo en la
    // tarjeta sin tener que consultar el historico.
    db.update(contacts)
      .set({
        approvedContactedAt: now,
        approvedContactMethod: method,
        ...(outcome === "contesto" && promisedDate
          ? { procedureStartDate: new Date(promisedDate) }
          : {}),
        ...(perdidoStage ? { stageId: perdidoStage.id, stageChangedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(contacts.id, contactId))
      .run();

    const partes = [
      CONTACT_METHOD_CONFIG[method as ContactMethod]?.label || method,
      MANAGEMENT_OUTCOME_CONFIG[outcome as ManagementOutcome]?.label || outcome,
    ];
    if (reason) {
      partes.push(
        MANAGEMENT_REASON_CONFIG[reason as ManagementReason]?.label || reason
      );
    }
    if (perdidoStage) partes.push("paso a Perdido");

    logAction(auth.user, {
      action: "gestionar",
      entity: "gestion",
      entityId: log.id,
      entityLabel: contact.name,
      detail: partes.join(" · "),
    });

    return NextResponse.json(
      { ...log, movedToLost: !!perdidoStage },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error al registrar la gestion: ${
          error instanceof Error ? error.message : "Unknown"
        }`,
      },
      { status: 500 }
    );
  }
}
