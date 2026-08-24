import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, pipelineStages } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { VisitResult } from "@/types";

/** Normaliza texto: sin acentos, minusculas, sin espacios sobrantes. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Acepta las etiquetas en espanol o los valores internos. */
function parseVisitResult(value: string): VisitResult | null {
  const v = normalize(value).replace(/\s+/g, "_");
  if (["aprobado", "aprobada", "aprobo"].includes(v)) return "aprobado";
  if (["negado", "negada", "rechazado", "rechazada"].includes(v)) return "negado";
  if (["sin_proceso", "sinproceso", "sin_procesos"].includes(v)) return "sin_proceso";
  return null;
}

/** Parser de CSV que respeta comillas y saltos de linea dentro de campos. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Quita el BOM que Excel agrega y unifica los saltos de linea.
  const content = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function findColumn(header: string[], candidates: string[]): number {
  return header.findIndex((h) => {
    const n = normalize(h).replace(/[.\s_]/g, "");
    return candidates.some((c) => n === c || n.includes(c));
  });
}

export async function POST(request: NextRequest) {
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

  return NextResponse.json(result);
}
