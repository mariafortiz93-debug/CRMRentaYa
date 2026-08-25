/**
 * Respaldo y restauracion de la base de datos.
 *
 * Toda la informacion del CRM vive en un solo archivo, `crm.db`. Respaldar es
 * copiar ese archivo; restaurar es volver a meter su contenido.
 *
 * Restaurar NO reemplaza el archivo en el disco: el servidor lo tiene abierto y
 * cambiarlo por debajo lo corrompe. En vez de eso se engancha el respaldo con
 * `ATTACH` y se copian las filas tabla por tabla dentro de una transaccion, asi
 * que o entra todo o no entra nada.
 */

import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { rawDb } from "@/db";
import { dataDir } from "@/db/paths";

/** Las 12 primeras letras de todo archivo SQLite. */
const SQLITE_MAGIC = "SQLite format 3";

/**
 * Tablas que se restauran, en orden de dependencia: primero las que nadie
 * referencia. Al borrar se recorre al reves.
 */
const TABLES = [
  "users",
  "audit_logs",
  "crm_settings",
  "pipeline_stages",
  "contacts",
  "deals",
  "visits",
  "management_logs",
  "activities",
] as const;

/** Tablas sin las cuales el archivo no es un respaldo de este CRM. */
const REQUIRED_TABLES = ["contacts", "pipeline_stages"];

function tempFile(prefix: string): string {
  return path.join(os.tmpdir(), `${prefix}-${crypto.randomUUID()}.db`);
}

/** Nombre con el que se descarga: `crm-respaldo-2026-08-25.db`. */
export function backupFileName(): string {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  return `crm-respaldo-${stamp}.db`;
}

/**
 * Copia consistente de la base, aunque haya escrituras en curso.
 *
 * Se usa `.backup()` de better-sqlite3 y no una copia del archivo a mano: en
 * modo WAL los cambios recientes viven en `crm.db-wal`, asi que copiar solo
 * `crm.db` dejaria fuera lo ultimo que se guardo.
 */
export async function createBackup(): Promise<Buffer> {
  const target = tempFile("crm-backup");
  try {
    await rawDb.backup(target);
    return fs.readFileSync(target);
  } finally {
    try {
      fs.unlinkSync(target);
    } catch {
      // Si no se puede borrar el temporal no pasa nada, lo limpia el sistema.
    }
  }
}

export interface RestoreResult {
  /** Cuantas filas quedaron en cada tabla. */
  filas: Record<string, number>;
  /** Donde quedo la copia de seguridad de lo que habia antes. */
  copiaPrevia: string;
}

function columnsOf(db: Database.Database, schema: string, table: string): string[] {
  const rows = db.prepare(`PRAGMA ${schema}.table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.map((r) => r.name);
}

function tableExists(db: Database.Database, schema: string, table: string): boolean {
  const row = db
    .prepare(
      `SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name = ?`
    )
    .get(table);
  return !!row;
}

/**
 * Restaura el contenido de un archivo de respaldo.
 *
 * Antes de tocar nada guarda una copia de lo que hay ahora, junto a la base,
 * por si el respaldo resulta ser el equivocado.
 */
export async function restoreBackup(fileBytes: Buffer): Promise<RestoreResult> {
  if (fileBytes.subarray(0, SQLITE_MAGIC.length).toString() !== SQLITE_MAGIC) {
    throw new Error(
      "El archivo no es un respaldo del CRM. Debe ser el .db que descargaste desde aqui."
    );
  }

  const incoming = tempFile("crm-restore");
  fs.writeFileSync(incoming, fileBytes);

  try {
    // Comprobar que trae lo que debe traer, antes de borrar nada.
    const check = new Database(incoming, { readonly: true });
    try {
      for (const table of REQUIRED_TABLES) {
        if (!tableExists(check, "main", table)) {
          throw new Error(
            `El respaldo no tiene la tabla "${table}". No parece una base de este CRM.`
          );
        }
      }
    } finally {
      check.close();
    }

    // Copia de lo que hay ahora, por si acaso.
    const copiaPrevia = path.join(
      dataDir(),
      `crm-antes-de-restaurar-${Date.now()}.db`
    );
    await rawDb.backup(copiaPrevia);

    // Las claves foraneas se apagan fuera de la transaccion: dentro, el PRAGMA
    // no tiene efecto. Sin esto el borrado fallaria por el orden de las tablas.
    rawDb.pragma("foreign_keys = OFF");
    rawDb.prepare("ATTACH DATABASE ? AS respaldo").run(incoming);

    try {
      const copiar = rawDb.transaction(() => {
        for (const table of [...TABLES].reverse()) {
          if (tableExists(rawDb, "main", table)) {
            rawDb.prepare(`DELETE FROM main.${table}`).run();
          }
        }

        for (const table of TABLES) {
          if (!tableExists(rawDb, "main", table)) continue;
          if (!tableExists(rawDb, "respaldo", table)) continue;

          // Solo las columnas que existen en ambos lados, para que un respaldo
          // viejo siga sirviendo aunque despues se hayan agregado campos.
          const destino = columnsOf(rawDb, "main", table);
          const origen = new Set(columnsOf(rawDb, "respaldo", table));
          const comunes = destino.filter((c) => origen.has(c));
          if (comunes.length === 0) continue;

          const lista = comunes.map((c) => `"${c}"`).join(", ");
          rawDb
            .prepare(
              `INSERT INTO main.${table} (${lista}) SELECT ${lista} FROM respaldo.${table}`
            )
            .run();
        }
      });

      copiar();

      const filas: Record<string, number> = {};
      for (const table of TABLES) {
        if (!tableExists(rawDb, "main", table)) continue;
        const row = rawDb
          .prepare(`SELECT COUNT(*) AS n FROM main.${table}`)
          .get() as { n: number };
        filas[table] = row.n;
      }

      return { filas, copiaPrevia };
    } finally {
      try {
        rawDb.prepare("DETACH DATABASE respaldo").run();
      } catch {
        // Si ya se solto, seguimos.
      }
      rawDb.pragma("foreign_keys = ON");
    }
  } finally {
    try {
      fs.unlinkSync(incoming);
    } catch {
      // Temporal: lo limpia el sistema.
    }
  }
}
