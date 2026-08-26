import type { PoolClient, Pool } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Mantiene las etapas del pipeline en la base de datos.
 *
 * Existia un problema doble:
 *  - La siembra corria en cada worker de Next.js y la comprobacion
 *    "si no hay etapas, crearlas" no es atomica: dos workers arrancando a la
 *    vez veian la tabla vacia y ambos insertaban, dejando etapas repetidas.
 *  - Sembraba las etapas genericas de la plantilla (Propuesta, Negociacion,
 *    Cerrado Ganado/Perdido) en vez de las del negocio.
 *
 * Esta funcion es idempotente: repara duplicados, crea lo que falte y toma las
 * etapas de crm-config.json. Un indice unico sobre el nombre impide que se
 * vuelvan a duplicar aunque varios procesos la ejecuten a la vez.
 */

interface StageDef {
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  nextAction?: string | null;
}

/** Etapas de respaldo si no hay crm-config.json. */
const FALLBACK_STAGES: StageDef[] = [
  { name: "Prospecto", order: 1, color: "#64748b", isWon: false, isLost: false, nextAction: "whatsapp" },
  { name: "Contactado", order: 2, color: "#3b82f6", isWon: false, isLost: false, nextAction: "call" },
  { name: "Visita al Concesionario", order: 3, color: "#06b6d4", isWon: false, isLost: false, nextAction: "whatsapp" },
  { name: "Registro Online", order: 4, color: "#8b5cf6", isWon: false, isLost: false, nextAction: "whatsapp" },
  { name: "Agendar Visita", order: 5, color: "#a855f7", isWon: false, isLost: false, nextAction: "call" },
  { name: "Visita", order: 6, color: "#d946ef", isWon: false, isLost: false, nextAction: "call" },
  { name: "Visitas Reagendadas", order: 7, color: "#f97316", isWon: false, isLost: false, nextAction: "call" },
  { name: "Estado de la Visita", order: 8, color: "#f59e0b", isWon: false, isLost: false, nextAction: "whatsapp" },
  { name: "Inicio de Tramite", order: 9, color: "#ea580c", isWon: false, isLost: false, nextAction: "call" },
  { name: "Moto Entregada", order: 10, color: "#16a34a", isWon: true, isLost: false, nextAction: null },
  { name: "Perdido", order: 11, color: "#dc2626", isWon: false, isLost: true, nextAction: null },
];

function readConfiguredStages(): StageDef[] {
  const candidates = [
    path.join(process.cwd(), "crm-config.json"),
    path.join(process.cwd(), "public", "crm-config.json"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
      const stages = cfg?.pipeline?.stages;
      if (Array.isArray(stages) && stages.length > 0) return stages as StageDef[];
    } catch {
      // Config ilegible: seguimos con el siguiente candidato.
    }
  }
  return FALLBACK_STAGES;
}


/** Apunta a `keepId` todo lo que referenciaba a `dropIds`, y las borra. */
async function mergeDuplicates(
  client: PoolClient,
  keepId: string,
  dropIds: string[]
): Promise<void> {
  for (const dropId of dropIds) {
    for (const [table, column] of [
      ["contacts", "stage_id"],
      ["deals", "stage_id"],
    ] as const) {
      await client.query(
        `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
        [keepId, dropId]
      );
    }
    await client.query("DELETE FROM pipeline_stages WHERE id = $1", [dropId]);
  }
}

export async function ensurePipelineStages(pool: Pool): Promise<void> {
  const stages = readConfiguredStages();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Unir etapas repetidas por nombre, conservando la primera.
    const existing = await client.query<{ id: string; name: string }>(
      'SELECT id, name FROM pipeline_stages ORDER BY "order"'
    );

    const byName = new Map<string, string[]>();
    for (const row of existing.rows) {
      const list = byName.get(row.name) || [];
      list.push(row.id);
      byName.set(row.name, list);
    }
    for (const [, ids] of byName) {
      if (ids.length > 1) await mergeDuplicates(client, ids[0], ids.slice(1));
    }

    // 2. Crear las que falten y alinear el resto con la configuracion.
    const configured = new Set<string>();
    for (const stage of stages) {
      configured.add(stage.name);
      const current = byName.get(stage.name)?.[0];
      const args = [
        stage.order,
        stage.color,
        stage.isWon,
        stage.isLost,
        stage.nextAction ?? null,
      ];

      if (current) {
        await client.query(
          `UPDATE pipeline_stages
           SET "order" = $1, color = $2, is_won = $3, is_lost = $4, next_action = $5
           WHERE id = $6`,
          [...args, current]
        );
      } else {
        await client.query(
          `INSERT INTO pipeline_stages (id, name, "order", color, is_won, is_lost, next_action)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), stage.name, ...args]
        );
      }
    }

    // 3. Etapas sobrantes de la plantilla: se borran si nadie las usa. Si
    //    todavia tienen clientes no se tocan (quedarian huerfanos), pero se
    //    mandan al final para que no se mezclen con el pipeline real.
    const lastOrder = stages.reduce((max, s) => Math.max(max, s.order), 0);
    let extra = 1;
    for (const [name, ids] of byName) {
      if (configured.has(name)) continue;
      const id = ids[0];
      const used = await client.query<{ n: string }>(
        "SELECT COUNT(*) AS n FROM contacts WHERE stage_id = $1",
        [id]
      );
      if (Number(used.rows[0].n) === 0) {
        await client.query("DELETE FROM pipeline_stages WHERE id = $1", [id]);
      } else {
        await client.query(
          'UPDATE pipeline_stages SET "order" = $1 WHERE id = $2',
          [lastOrder + extra++, id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
