import type Database from "better-sqlite3";
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
function mergeDuplicates(
  db: Database.Database,
  keepId: string,
  dropIds: string[]
): void {
  for (const dropId of dropIds) {
    for (const [table, column] of [
      ["contacts", "stage_id"],
      ["deals", "stage_id"],
    ] as const) {
      try {
        db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(
          keepId,
          dropId
        );
      } catch {
        // La tabla puede no existir todavia.
      }
    }
    db.prepare("DELETE FROM pipeline_stages WHERE id = ?").run(dropId);
  }
}

export function ensurePipelineStages(db: Database.Database): void {
  const stages = readConfiguredStages();

  const run = db.transaction(() => {
    // 1. Unir etapas repetidas por nombre, conservando la primera.
    const existing = db
      .prepare('SELECT id, name FROM pipeline_stages ORDER BY "order", rowid')
      .all() as Array<{ id: string; name: string }>;

    const byName = new Map<string, string[]>();
    for (const row of existing) {
      const list = byName.get(row.name) || [];
      list.push(row.id);
      byName.set(row.name, list);
    }
    for (const [, ids] of byName) {
      if (ids.length > 1) mergeDuplicates(db, ids[0], ids.slice(1));
    }

    // 2. Crear las que falten y alinear el resto con la configuracion.
    const insert = db.prepare(
      `INSERT INTO pipeline_stages (id, name, "order", color, is_won, is_lost, next_action)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const update = db.prepare(
      `UPDATE pipeline_stages
       SET "order" = ?, color = ?, is_won = ?, is_lost = ?, next_action = ?
       WHERE id = ?`
    );

    const configured = new Set<string>();
    for (const stage of stages) {
      configured.add(stage.name);
      const current = byName.get(stage.name)?.[0];
      const args = [
        stage.order,
        stage.color,
        stage.isWon ? 1 : 0,
        stage.isLost ? 1 : 0,
        stage.nextAction ?? null,
      ] as const;

      if (current) update.run(...args, current);
      else insert.run(crypto.randomUUID(), stage.name, ...args);
    }

    // 3. Etapas sobrantes de la plantilla: se borran si nadie las usa. Si
    //    todavia tienen clientes no se tocan (quedarian huerfanos), pero se
    //    mandan al final para que no se mezclen con el pipeline real.
    const lastOrder = stages.reduce((max, s) => Math.max(max, s.order), 0);
    let extra = 1;
    for (const [name, ids] of byName) {
      if (configured.has(name)) continue;
      const id = ids[0];
      const used = db
        .prepare("SELECT COUNT(*) AS n FROM contacts WHERE stage_id = ?")
        .get(id) as { n: number };
      if (used.n === 0) {
        db.prepare("DELETE FROM pipeline_stages WHERE id = ?").run(id);
      } else {
        db.prepare('UPDATE pipeline_stages SET "order" = ? WHERE id = ?').run(
          lastOrder + extra++,
          id
        );
      }
    }
  });

  run();

  // 4. Con la tabla ya limpia, impedir que se vuelvan a duplicar.
  try {
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_stages_name ON pipeline_stages(name)"
    );
  } catch {
    // Si quedara algun duplicado imposible de unir, no bloqueamos el arranque.
  }
}
