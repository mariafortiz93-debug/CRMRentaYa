/**
 * Importa contactos desde el mismo CSV que produce `/api/export?type=contacts`.
 *
 * Sirve para volver a cargar la informacion despues de una perdida de datos y
 * para subir listas hechas en Excel. La idea es que el archivo que se descarga
 * se pueda volver a subir tal cual, sin tocarle nada.
 *
 * Identifica al cliente por **cedula**; si la fila no la trae, por telefono.
 * Si lo encuentra actualiza, si no lo crea. Nunca duplica por nombre: dos
 * personas pueden llamarse igual.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, pipelineStages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { SOURCE_LABELS, MOTORCYCLE_LABELS } from "@/lib/constants";
import { parseCSV, normalize, findColumn, labelToValue } from "@/lib/csv";

/** Columnas del export, con los nombres alternativos que acepta cada una. */
const COLUMNS = {
  name: ["nombre", "nombrecompleto"],
  phone: ["telefono", "telefono1", "celular"],
  phone2: ["telefono2", "whatsapp"],
  address: ["direccion"],
  city: ["ciudad"],
  neighborhood: ["barrio"],
  identificationNumber: ["noidentificacion", "identificacion", "cedula"],
  expeditionCity: ["ciudadexpedicion", "expedicion"],
  companionName: ["acompanante", "nombredelacompanante"],
  motorcycleInterest: ["motodeinteres", "moto"],
  company: ["empresa"],
  source: ["comosupodelaempresa", "fuente", "origen"],
  notes: ["notas", "observaciones"],
  stage: ["etapa"],
} as const;

type ColumnKey = keyof typeof COLUMNS;

export async function POST(request: NextRequest) {
  const auth = await requirePermission("contactos_crear", request);
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
  const idx = {} as Record<ColumnKey, number>;
  for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
    idx[key] = findColumn(header, [...COLUMNS[key]]);
  }

  if (idx.name === -1) {
    return NextResponse.json(
      {
        error:
          "No se encontro la columna 'Nombre'. Descarga el archivo de Exportar y usa esa misma estructura.",
        columnasEncontradas: header,
      },
      { status: 400 }
    );
  }

  const stages = (await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order))
    );
  const firstStageId = stages[0]?.id ?? null;
  const stageByName = new Map(stages.map((s) => [normalize(s.name), s.id]));

  const result = {
    creados: 0,
    actualizados: 0,
    omitidos: 0,
    sinFuente: 0,
    etapaDesconocida: [] as string[],
    /** Filas que coincidian por cedula o telefono pero con otro nombre. */
    duplicados: [] as string[],
  };

  const cell = (row: string[], key: ColumnKey): string =>
    idx[key] === -1 ? "" : (row[idx[key]] || "").trim();

  const now = new Date();

  for (const row of rows.slice(1)) {
    const name = cell(row, "name");
    if (!name) {
      result.omitidos++;
      continue;
    }

    const cedula = cell(row, "identificationNumber");
    const phone = cell(row, "phone");

    // Las etiquetas del CSV vuelven a su valor interno ("Redes sociales" ->
    // "redes"). Si no se reconoce, se deja vacio en vez de inventar "otro":
    // un lead sin fuente se ve en el dashboard, uno mal clasificado no.
    const source = labelToValue(SOURCE_LABELS, cell(row, "source"));
    if (!source) result.sinFuente++;

    const motorcycleInterest = labelToValue(
      MOTORCYCLE_LABELS,
      cell(row, "motorcycleInterest")
    );

    // La columna "Etapa" es opcional: el export de contactos no la trae por
    // defecto, pero si el archivo la incluye se respeta.
    const rawStage = cell(row, "stage");
    let stageId = firstStageId;
    if (rawStage) {
      const found = stageByName.get(normalize(rawStage));
      if (found) stageId = found;
      else if (!result.etapaDesconocida.includes(rawStage))
        result.etapaDesconocida.push(rawStage);
    }

    // Solo se escriben los campos que traen dato: una celda vacia no debe
    // borrar lo que ya estaba guardado en el CRM.
    const values = {
      name,
      phone: phone || undefined,
      phone2: cell(row, "phone2") || undefined,
      address: cell(row, "address") || undefined,
      city: cell(row, "city") || undefined,
      neighborhood: cell(row, "neighborhood") || undefined,
      identificationNumber: cedula || undefined,
      expeditionCity: cell(row, "expeditionCity") || undefined,
      companionName: cell(row, "companionName") || undefined,
      motorcycleInterest: motorcycleInterest || undefined,
      company: cell(row, "company") || undefined,
      source: source || undefined,
      notes: cell(row, "notes") || undefined,
    };
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined)
    );

    // Se busca por cedula, y si la fila no la trae, por telefono.
    const candidatos = cedula
      ? (await db
          .select()
          .from(contacts)
          .where(eq(contacts.identificationNumber, cedula))
          )
      : phone
        ? (await db.select().from(contacts).where(eq(contacts.phone, phone)))
        : [];

    /**
     * El nombre decide si es la misma persona.
     *
     * Una cedula mal digitada, o un telefono de familia, hacen que dos
     * clientes distintos coincidan. Sin esta comprobacion el segundo pisaba
     * al primero y se perdia un cliente sin avisar. Se acepta que el nombre
     * crezca ("Ramiro Salcedo" -> "Ramiro Salcedo Perez"), pero no que sea
     * otro: en ese caso se crea aparte y se reporta para revisar a mano.
     */
    const filaNombre = normalize(name);
    const existing = candidatos.find((c) => {
      const suyo = normalize(c.name);
      return suyo === filaNombre || suyo.includes(filaNombre) || filaNombre.includes(suyo);
    });

    if (!existing && candidatos.length > 0) {
      result.duplicados.push(
        `${name} (${cedula || phone}) ya estaba como "${candidatos[0].name}"`
      );
    }

    if (existing) {
      (await db.update(contacts)
        .set({
          ...filled,
          // La etapa solo se cambia si el archivo la trae explicita.
          ...(rawStage && stageId && stageId !== existing.stageId
            ? { stageId, stageChangedAt: now }
            : {}),
          updatedAt: now,
        })
        .where(eq(contacts.id, existing.id))
        );
      result.actualizados++;
      continue;
    }

    (await db.insert(contacts)
      .values({
        ...filled,
        name,
        source: source || "otro",
        stageId,
        stageChangedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      );
    result.creados++;
  }

  if (result.creados > 0 || result.actualizados > 0) {
    logAction(auth.user, {
      action: "importar",
      entity: "contacto",
      detail: `Importo contactos desde Excel: ${result.creados} nuevo(s) y ${result.actualizados} actualizado(s)`,
    });
  }

  return NextResponse.json(result);
}
