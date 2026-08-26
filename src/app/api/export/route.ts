import { NextRequest } from "next/server";
import { db } from "@/db";
import { contacts, pipelineStages } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  formatDate,
  SOURCE_LABELS,
  MOTORCYCLE_LABELS,
  VISIT_RESULT_CONFIG,
} from "@/lib/constants";
import { resolveDateRange, inRange } from "@/lib/dateRange";
import type { LeadSource, MotorcycleInterest, VisitResult } from "@/types";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function csvResponse(csv: string, filename: string): Response {
  // BOM para que Excel abra el CSV con acentos correctamente.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "contacts";
  const today = new Date().toISOString().split("T")[0];
  const range = resolveDateRange({
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });

  const allContacts = db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt))
    .all()
    .filter((c) => inRange(c.createdAt, range));

  /**
   * Exportacion de contactos: los campos del formulario de registro, mas la
   * etapa. La etapa va al final para que el archivo se pueda volver a subir
   * por Importar y cada cliente regrese a su columna del pipeline.
   */
  if (type === "contacts") {
    const stageNameById = new Map(
      db.select().from(pipelineStages).all().map((s) => [s.id, s.name])
    );

    const headers = [
      "Nombre",
      "Telefono",
      "Telefono 2",
      "Direccion",
      "Ciudad",
      "Barrio",
      "No. Identificacion",
      "Ciudad Expedicion",
      "Acompañante",
      "Moto de Interes",
      "Empresa",
      "Como supo de la empresa",
      "Notas",
      "Etapa",
    ];

    const rows = allContacts.map((c) => [
      c.name,
      c.phone || "",
      c.phone2 || "",
      c.address || "",
      c.city || "",
      c.neighborhood || "",
      c.identificationNumber || "",
      c.expeditionCity || "",
      c.companionName || "",
      MOTORCYCLE_LABELS[c.motorcycleInterest as MotorcycleInterest] ||
        c.motorcycleInterest ||
        "",
      c.company || "",
      SOURCE_LABELS[c.source as LeadSource] || c.source,
      c.notes || "",
      stageNameById.get(c.stageId || "") || "",
    ]);

    return csvResponse(buildCSV(headers, rows), `contactos-${today}.csv`);
  }

  /**
   * Plantilla de estados de visita: se descarga, se completa la columna
   * "Estado Visita" en la otra plataforma y se vuelve a importar.
   */
  if (type === "visit-states") {
    const stages = db.select().from(pipelineStages).all();
    const stageById = new Map(stages.map((s) => [s.id, s]));

    // Clientes que ya tienen visita registrada o estan en etapas posteriores.
    const relevant = allContacts.filter((c) => {
      const stageName = (stageById.get(c.stageId || "")?.name || "").toLowerCase();
      return (
        c.visitResult !== null ||
        ["visita", "visitas reagendadas", "estado de la visita"].includes(stageName)
      );
    });

    const headers = [
      "No. Identificacion",
      "Nombre",
      "Telefono",
      "Etapa",
      "Estado Visita",
      "Motivo",
    ];

    const rows = relevant.map((c) => [
      c.identificationNumber || "",
      c.name,
      c.phone || "",
      stageById.get(c.stageId || "")?.name || "",
      c.visitResult
        ? VISIT_RESULT_CONFIG[c.visitResult as VisitResult]?.label || c.visitResult
        : "",
      c.visitResultNote || "",
    ]);

    return csvResponse(buildCSV(headers, rows), `estados-visita-${today}.csv`);
  }

  // Resultados de visita ya definidos, para reportes.
  if (type === "visit-results") {
    const headers = [
      "No. Identificacion",
      "Nombre",
      "Telefono",
      "Estado Visita",
      "Motivo",
      "Fecha Resultado",
      "Inicio Tramite",
    ];

    const rows = allContacts
      .filter((c) => c.visitResult)
      .map((c) => [
        c.identificationNumber || "",
        c.name,
        c.phone || "",
        VISIT_RESULT_CONFIG[c.visitResult as VisitResult]?.label || c.visitResult || "",
        c.visitResultNote || "",
        c.visitResultDate ? formatDate(c.visitResultDate) : "",
        c.procedureStartDate ? formatDate(c.procedureStartDate) : "",
      ]);

    return csvResponse(buildCSV(headers, rows), `resultados-visita-${today}.csv`);
  }

  return new Response(
    "Tipo invalido. Use ?type=contacts, visit-states o visit-results",
    { status: 400 }
  );
}
