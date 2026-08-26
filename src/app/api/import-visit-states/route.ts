import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, pipelineStages } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { VisitResult } from "@/types";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { parseCSV, normalize, findColumn } from "@/lib/csv";

/** Acepta las etiquetas en espanol o los valores internos. */
function parseVisitResult(value: string): VisitResult | null {
  const v = normalize(value).replace(/\s+/g, "_");
  if (["aprobado", "aprobada", "aprobo"].includes(v)) return "aprobado";
  if (["negado", "negada", "rechazado", "rechazada"].includes(v)) return "negado";
  if (["sin_proceso", "sinproceso", "sin_procesos"].includes(v)) return "sin_proceso";
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("contactos_editar", request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const csv: string = body.csv;
  if (!csv || typeof csv !== "string") {
    return NextResponse.json(
      { error: "Falta el contenido del archivo" },
      { status: 400 }
    );
  }

  const rows = parseCSV(csv);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "El archivo no tiene filas de datos" },
      { status: 400 }
    );
  }

  const header = rows[0];
  const idIdx = findColumn(header, ["noidentificacion", "identificacion", "cedula"]);
  const stateIdx = findColumn(header, ["estadovisita", "estado", "resultado"]);
  const noteIdx = findColumn(header, ["motivo", "observacion", "nota"]);

  if (idIdx === -1) {
    return NextResponse.json(
      {
        error:
          "No se encontro la columna de identificacion. Debe llamarse 'No. Identificacion' o 'Cedula'.",
        columnasEncontradas: header,
      },
      { status: 400 }
    );
  }
  if (stateIdx === -1) {
    return NextResponse.json(
      {
        error:
          "No se encontro la columna de estado. Debe llamarse 'Estado Visita' o 'Resultado'.",
        columnasEncontradas: header,
      },
      { status: 400 }
    );
  }

  const stages = db.select().from(pipelineStages).all();
  const estadoStage = stages.find(
    (s) => s.name.toLowerCase() === "estado de la visita"
  );

  const result = {
    actualizados: 0,
    sinCambios: 0,
    noEncontrados: [] as string[],
    estadoInvalido: [] as string[],
  };

  const now = new Date();

  for (const row of rows.slice(1)) {
    const cedula = (row[idIdx] || "").trim();
    const rawState = (row[stateIdx] || "").trim();
    if (!cedula) continue;

    if (!rawState) {
      result.sinCambios++;
      continue;
    }

    const state = parseVisitResult(rawState);
    if (!state) {
      result.estadoInvalido.push(`${cedula}: "${rawState}"`);
      continue;
    }

    const contact = db
      .select()
      .from(contacts)
      .where(eq(contacts.identificationNumber, cedula))
      .get();

    if (!contact) {
      result.noEncontrados.push(cedula);
      continue;
    }

    const note = noteIdx !== -1 ? (row[noteIdx] || "").trim() : "";

    db.update(contacts)
      .set({
        visitResult: state,
        visitResultDate: now,
        visitResultNote:
          state === "aprobado" ? null : note || contact.visitResultNote,
        // Al llegar un resultado, el cliente pertenece a "Estado de la Visita".
        stageId: estadoStage?.id ?? contact.stageId,
        updatedAt: now,
      })
      .where(eq(contacts.id, contact.id))
      .run();

    result.actualizados++;
  }

  if (result.actualizados > 0) {
    logAction(auth.user, {
      action: "importar",
      entity: "contacto",
      detail: `Importo estados de visita: ${result.actualizados} cliente(s) actualizado(s)`,
    });
  }

  return NextResponse.json(result);
}
