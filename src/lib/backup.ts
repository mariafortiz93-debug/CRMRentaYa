/**
 * Respaldo y restauracion de la base de datos.
 *
 * Con SQLite el respaldo era una copia del archivo `crm.db`. Con PostgreSQL la
 * base es un servicio aparte y no hay archivo que copiar; `pg_dump` tampoco
 * esta dentro del contenedor. Asi que el respaldo es un **JSON** con el
 * contenido de todas las tablas: se lee sin herramientas especiales, se puede
 * revisar a ojo y no depende de la version de Postgres que use el hosting.
 *
 * Restaurar reemplaza TODO, dentro de una sola transaccion: o entra completo o
 * no entra nada. Si falla a mitad, la base queda como estaba.
 */

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { rawDb } from "@/db";
import { TABLES_IN_DELETE_ORDER } from "@/db/ddl";

/** Marca que identifica un respaldo de este CRM. */
const FORMATO = "crm-renta-ya";
const VERSION = 1;

/**
 * Orden para insertar: primero las tablas de las que dependen las demas.
 * Al borrar se recorre al reves (hijas primero), porque las claves foraneas
 * no se pueden desactivar sin permisos de administrador de Postgres.
 */
const TABLES_IN_INSERT_ORDER = [...TABLES_IN_DELETE_ORDER].reverse();

/** Tablas sin las cuales el archivo no es un respaldo de este CRM. */
const REQUIRED_TABLES = ["contacts", "pipeline_stages"];

type Row = Record<string, unknown>;

interface BackupFile {
  formato: string;
  version: number;
  fecha: string;
  tablas: Record<string, Row[]>;
}

/** Nombre con el que se descarga: `crm-respaldo-2026-08-26.json`. */
export function backupFileName(): string {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  return `crm-respaldo-${stamp}.json`;
}

/** Columnas que existen hoy en una tabla. */
async function columnsOf(table: string): Promise<Set<string>> {
  const res = await rawDb.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(res.rows.map((r) => r.column_name));
}

/** Lee todas las tablas del CRM. */
async function dump(): Promise<BackupFile> {
  const tablas: Record<string, Row[]> = {};
  for (const table of TABLES_IN_INSERT_ORDER) {
    const res = await rawDb.query(`SELECT * FROM ${table}`);
    tablas[table] = res.rows as Row[];
  }
  return {
    formato: FORMATO,
    version: VERSION,
    fecha: new Date().toISOString(),
    tablas,
  };
}

/** Respaldo completo, listo para descargar. */
export async function createBackup(): Promise<Buffer> {
  const data = await dump();
  return Buffer.from(JSON.stringify(data, null, 2), "utf8");
}

export interface RestoreResult {
  ok: true;
  /** Cuantas filas entraron en cada tabla. */
  filas: Record<string, number>;
  /** Tablas del respaldo que este CRM ya no tiene. */
  ignoradas: string[];
  /** Donde quedo la copia de lo que habia antes. */
  copiaPrevia: string;
}

function parseBackup(fileBytes: Buffer): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileBytes.toString("utf8"));
  } catch {
    throw new Error(
      "El archivo no es un respaldo del CRM (no se pudo leer como JSON)."
    );
  }

  const data = parsed as Partial<BackupFile>;
  if (data?.formato !== FORMATO || typeof data.tablas !== "object" || !data.tablas) {
    throw new Error(
      "El archivo no es un respaldo de este CRM. Descarga uno desde " +
        "Configuracion -> Respaldos y usa ese."
    );
  }

  for (const table of REQUIRED_TABLES) {
    if (!Array.isArray(data.tablas[table])) {
      throw new Error(
        `El respaldo esta incompleto: le falta la tabla "${table}".`
      );
    }
  }

  return data as BackupFile;
}

/**
 * Reemplaza el contenido de la base por el del respaldo.
 *
 * Solo se copian las columnas que existen **en los dos lados**, para que un
 * respaldo viejo siga sirviendo aunque despues se hayan agregado campos.
 */
export async function restoreBackup(fileBytes: Buffer): Promise<RestoreResult> {
  const data = parseBackup(fileBytes);

  // Copia de lo que hay ahora, por si el archivo subido era el equivocado.
  // Vive en la carpeta temporal del contenedor: sirve mientras el servidor no
  // se reinicie, no reemplaza a descargar un respaldo antes de restaurar.
  const copiaPrevia = path.join(
    os.tmpdir(),
    `crm-antes-de-restaurar-${crypto.randomUUID()}.json`
  );
  fs.writeFileSync(copiaPrevia, await createBackup());

  const filas: Record<string, number> = {};
  const ignoradas: string[] = [];

  const client = await rawDb.connect();
  try {
    await client.query("BEGIN");

    // Borrar hijas primero: las claves foraneas siguen activas.
    for (const table of TABLES_IN_DELETE_ORDER) {
      await client.query(`DELETE FROM ${table}`);
    }

    for (const table of TABLES_IN_INSERT_ORDER) {
      const rows = data.tablas[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        filas[table] = 0;
        continue;
      }

      const existing = await columnsOf(table);
      const columns = Object.keys(rows[0]).filter((c) => existing.has(c));
      if (columns.length === 0) {
        ignoradas.push(table);
        filas[table] = 0;
        continue;
      }

      // De a 100 filas por sentencia: una por fila seria lentisimo por red.
      const CHUNK = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const values: unknown[] = [];
        const tuples = chunk.map((row) => {
          const marks = columns.map((col) => {
            values.push(row[col] ?? null);
            return `$${values.length}`;
          });
          return `(${marks.join(", ")})`;
        });
        await client.query(
          `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(", ")})
           VALUES ${tuples.join(", ")}`,
          values
        );
        inserted += chunk.length;
      }
      filas[table] = inserted;
    }

    // Tablas del respaldo que este CRM ya no conoce.
    for (const table of Object.keys(data.tablas)) {
      if (!TABLES_IN_INSERT_ORDER.includes(table) && !ignoradas.includes(table)) {
        ignoradas.push(table);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(
      "No se pudo restaurar; la base quedo como estaba. " +
        (error instanceof Error ? error.message : "")
    );
  } finally {
    client.release();
  }

  return { ok: true, filas, ignoradas, copiaPrevia };
}
