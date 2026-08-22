import { NextRequest } from "next/server";
import { db } from "@/db";
import { contacts, deals, pipelineStages } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { formatDate, formatCurrency, SOURCE_LABELS, MOTORCYCLE_LABELS, VISIT_RESULT_CONFIG } from "@/lib/constants";
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "contacts";
  const today = new Date().toISOString().split("T")[0];

  if (type === "contacts") {
    const allContacts = db
      .select({
        name: contacts.name,
        phone: contacts.phone,
        phone2: contacts.phone2,
        address: contacts.address,
        city: contacts.city,
        neighborhood: contacts.neighborhood,
        identificationNumber: contacts.identificationNumber,
        expeditionCity: contacts.expeditionCity,
        companionName: contacts.companionName,
        motorcycleInterest: contacts.motorcycleInterest,
        company: contacts.company,
        source: contacts.source,
        score: contacts.score,
        notes: contacts.notes,
        visitResult: contacts.visitResult,
        visitResultNote: contacts.visitResultNote,
        procedureStartDate: contacts.procedureStartDate,
        createdAt: contacts.createdAt,
        stageName: pipelineStages.name,
      })
      .from(contacts)
      .leftJoin(pipelineStages, eq(contacts.stageId, pipelineStages.id))
      .orderBy(desc(contacts.createdAt))
      .all();

    const headers = [
      "Nombre",
      "Etapa",
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
      "Fuente",
      "Resultado Visita",
      "Motivo Resultado",
      "Inicio Tramite",
      "Score",
      "Notas",
      "Fecha de creacion",
    ];

    const rows = allContacts.map((c) => [
      c.name,
      c.stageName || "",
      c.phone || "",
      c.phone2 || "",
      c.address || "",
      c.city || "",
      c.neighborhood || "",
      c.identificationNumber || "",
      c.expeditionCity || "",
      c.companionName || "",
      MOTORCYCLE_LABELS[c.motorcycleInterest as MotorcycleInterest] || c.motorcycleInterest || "",
      c.company || "",
      SOURCE_LABELS[c.source as LeadSource] || c.source,
      c.visitResult ? VISIT_RESULT_CONFIG[c.visitResult as VisitResult]?.label || c.visitResult : "",
      c.visitResultNote || "",
      c.procedureStartDate ? formatDate(c.procedureStartDate) : "",
      String(c.score),
      c.notes || "",
      formatDate(c.createdAt),
    ]);

    const csv = buildCSV(headers, rows);

    return new Response("\ufeff" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contactos-${today}.csv"`,
      },
    });
  }

  if (type === "deals") {
    const allDeals = db
      .select({
        title: deals.title,
        value: deals.value,
        probability: deals.probability,
        notes: deals.notes,
        expectedClose: deals.expectedClose,
        createdAt: deals.createdAt,
        contactName: contacts.name,
        stageName: pipelineStages.name,
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .orderBy(asc(pipelineStages.order))
      .all();

    const headers = [
      "Titulo",
      "Valor",
      "Contacto",
      "Etapa",
      "Probabilidad",
      "Cierre Estimado",
      "Notas",
      "Fecha de creacion",
    ];

    const rows = allDeals.map((d) => [
      d.title,
      formatCurrency(d.value),
      d.contactName || "",
      d.stageName || "",
      `${d.probability}%`,
      formatDate(d.expectedClose),
      d.notes || "",
      formatDate(d.createdAt),
    ]);

    const csv = buildCSV(headers, rows);

    return new Response("\ufeff" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deals-${today}.csv"`,
      },
    });
  }

  return new Response("Tipo invalido. Use ?type=contacts o ?type=deals", {
    status: 400,
  });
}
