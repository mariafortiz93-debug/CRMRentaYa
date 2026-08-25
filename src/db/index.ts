import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensurePipelineStages } from "./stages";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "crm.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function createDatabase(): Database.Database {
  const db = new Database(DB_PATH, { timeout: 15000 });

  // Set pragmas individually with error handling
  try {
    db.pragma("journal_mode = WAL");
  } catch {
    // WAL mode might already be set by another process
  }

  try {
    db.pragma("busy_timeout = 15000");
  } catch {
    // Ignore if can't set
  }

  try {
    db.pragma("foreign_keys = ON");
  } catch {
    // Ignore
  }

  return db;
}

function initTables(db: Database.Database): void {
  // Each CREATE TABLE is its own statement to minimize lock time
  const tables = [
    `CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      is_won INTEGER NOT NULL DEFAULT 0,
      is_lost INTEGER NOT NULL DEFAULT 0,
      next_action TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stage_id TEXT REFERENCES pipeline_stages(id),
      phone TEXT,
      phone2 TEXT,
      address TEXT,
      city TEXT,
      neighborhood TEXT,
      identification_number TEXT,
      expedition_city TEXT,
      companion_name TEXT,
      motorcycle_interest TEXT,
      company TEXT,
      source TEXT NOT NULL DEFAULT 'otro',
      score INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      contact_method TEXT,
      plan TEXT,
      classification TEXT,
      classification_detail TEXT,
      classification_date INTEGER,
      visit_result TEXT,
      visit_result_date INTEGER,
      visit_result_note TEXT,
      stage_changed_at INTEGER,
      approved_contacted_at INTEGER,
      approved_contact_method TEXT,
      procedure_start_date INTEGER,
      dealership_announced_at INTEGER,
      dealership_visited_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS management_logs (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      method TEXT NOT NULL,
      outcome TEXT NOT NULL,
      promised_date INTEGER,
      reason TEXT,
      reason_detail TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      visitador TEXT NOT NULL,
      neighborhood TEXT,
      scheduled_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      stage_id TEXT NOT NULL REFERENCES pipeline_stages(id),
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      expected_close INTEGER,
      probability INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      deal_id TEXT REFERENCES deals(id),
      scheduled_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS crm_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ];

  for (const sql of tables) {
    try {
      db.exec(sql);
    } catch {
      // Table might already exist or DB is locked - safe to continue
    }
  }
}

const sqlite = createDatabase();
initTables(sqlite);
try {
  // Repara duplicados y alinea las etapas con crm-config.json. Es idempotente
  // y esta protegida por un indice unico, asi que varios workers arrancando a
  // la vez no pueden dejar etapas repetidas.
  ensurePipelineStages(sqlite);
} catch {
  // Si otro worker la esta ejecutando, no bloqueamos el arranque.
}

export const db = drizzle(sqlite, { schema });
