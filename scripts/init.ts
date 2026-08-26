#!/usr/bin/env npx tsx

/**
 * Preparacion de la base de datos. Corre **al arrancar el contenedor** (ver el
 * `CMD` del Dockerfile) y en local con `npm run init`.
 *
 * Es el unico sitio donde se crean tablas y se siembra: las etapas del
 * pipeline y el super administrador. Antes esto ocurria al importar el modulo
 * de la base, y como Next levanta varios procesos, todos competian por sembrar
 * lo mismo; asi aparecieron las etapas duplicadas.
 *
 * Deja en el log del hosting cuantas filas hay en cada tabla. Si un dia se
 * pierden datos, se ve el mismo dia y no semanas despues.
 */

import { Pool } from "pg";
import { ensureSchema, TABLES_IN_DELETE_ORDER } from "../src/db/ddl";
import { ensurePipelineStages } from "../src/db/stages";
import { ensureSuperAdmin, ensureRecoveryAdmin } from "../src/db/users";
import { databaseUrl, sslOption, describeDatabase } from "../src/db/paths";

async function main(): Promise<void> {
  const url = databaseUrl();
  console.log("Preparando el CRM...");
  console.log(`Base de datos: ${describeDatabase(url)}`);

  const pool = new Pool({
    connectionString: url,
    ssl: sslOption(url),
    max: 4,
    connectionTimeoutMillis: 20_000,
  });

  try {
    // Si la tabla de clientes ya existia, la base sobrevivio al despliegue
    // anterior. Se comprueba antes de crear nada.
    const before = await pool.query<{ exists: boolean }>(
      "SELECT to_regclass('public.contacts') IS NOT NULL AS exists"
    );
    const existedBefore = before.rows[0].exists;
    console.log(`Base existente: ${existedBefore ? "si" : "no (arranca vacia)"}`);

    await ensureSchema(pool);
    console.log("Tablas listas.");

    // Crea las etapas que falten, une las repetidas y las alinea con la config.
    await ensurePipelineStages(pool);
    const stages = await pool.query<{ name: string }>(
      'SELECT name FROM pipeline_stages ORDER BY "order"'
    );
    console.log(`Etapas del pipeline (${stages.rows.length}):`);
    console.log("  " + stages.rows.map((s) => s.name).join(" -> "));

    // Super administrador. Solo se crea si no existe ninguno.
    await ensureSuperAdmin(pool);
    // Llave de repuesto, si estan CRM_RECOVERY_USER y CRM_RECOVERY_PASSWORD.
    await ensureRecoveryAdmin(pool);
    const admins = await pool.query<{ username: string }>(
      "SELECT username FROM users WHERE role = 'super_admin' ORDER BY username"
    );
    console.log(
      `Super administrador: ${
        admins.rows.map((a) => a.username).join(", ") || "ninguno"
      }`
    );

    const counts: string[] = [];
    for (const table of TABLES_IN_DELETE_ORDER) {
      const row = await pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM ${table}`
      );
      counts.push(`${table}=${row.rows[0].n}`);
    }
    console.log(`Datos: ${counts.join(" ")}`);

    if (!existedBefore && process.env.NODE_ENV === "production") {
      console.warn(
        [
          "",
          "*** AVISO: la base de datos estaba vacia al arrancar. ***",
          `Base: ${describeDatabase(url)}`,
          "Si esperabas encontrar clientes aqui, revisa que DATABASE_URL",
          "apunte al servicio de Postgres correcto y no a uno recien creado.",
          "",
        ].join("\n")
      );
    }

    console.log("\nCRM listo.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("No se pudo preparar la base de datos:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
