#!/usr/bin/env npx tsx

/**
 * Auto-CRM initialization script.
 * Creates the database, seeds default pipeline stages,
 * and optionally seeds demo data.
 *
 * Usage:
 *   npx tsx scripts/init.ts          # Init only
 *   npx tsx scripts/init.ts --seed   # Init + demo data
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ensurePipelineStages } from "../src/db/stages";
import { ensureSuperAdmin } from "../src/db/users";
import { dbPath, ensureDataDir } from "../src/db/paths";

const DB_PATH = dbPath();
const shouldSeed = process.argv.includes("--seed");

ensureDataDir();

// Si el archivo ya existia, el disco sobrevivio al despliegue anterior. Si no,
// o es la primera vez, o la carpeta NO es persistente y se acaban de perder
// los datos. Se avisa mas abajo, cuando ya se pueden contar las filas.
const dbExistedBefore = fs.existsSync(DB_PATH);

console.log("Initializing Auto-CRM...");
console.log(`Database: ${DB_PATH}`);
console.log(`Base existente: ${dbExistedBefore ? "si" : "no (arranca vacia)"}`);

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'asesor',
    permissions TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    entity_label TEXT,
    detail TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

  CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b',
    is_won INTEGER NOT NULL DEFAULT 0,
    is_lost INTEGER NOT NULL DEFAULT 0,
    next_action TEXT
  );

  CREATE TABLE IF NOT EXISTS contacts (
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
  );

  CREATE TABLE IF NOT EXISTS management_logs (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    method TEXT NOT NULL,
    outcome TEXT NOT NULL,
    promised_date INTEGER,
    reason TEXT,
    reason_detail TEXT,
    note TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    visitador TEXT NOT NULL,
    neighborhood TEXT,
    scheduled_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deals (
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
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    deal_id TEXT REFERENCES deals(id),
    scheduled_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS crm_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

console.log("Tables created.");

// La configuracion debe existir antes de sembrar, porque de ahi salen las etapas.
const configPath = path.join(process.cwd(), "crm-config.json");
const defaultConfigPath = path.join(process.cwd(), "public", "crm-config.json");
if (!fs.existsSync(configPath) && fs.existsSync(defaultConfigPath)) {
  fs.copyFileSync(defaultConfigPath, configPath);
  console.log("Default crm-config.json created.");
}

// Crea las etapas que falten, une las repetidas y las alinea con la config.
ensurePipelineStages(sqlite);
const stages = sqlite
  .prepare('SELECT name FROM pipeline_stages ORDER BY "order"')
  .all() as Array<{ name: string }>;
console.log(`Pipeline stages ready (${stages.length}):`);
console.log("  " + stages.map((s) => s.name).join(" -> "));

// Super administrador. Solo se crea si no existe ninguno.
ensureSuperAdmin(sqlite);
const admins = sqlite
  .prepare("SELECT username FROM users WHERE role = 'super_admin'")
  .all() as Array<{ username: string }>;
console.log(
  `Super administrador: ${admins.map((a) => a.username).join(", ") || "ninguno"}`
);

// Recuento de lo que hay. Queda en el log del hosting, asi que si un despliegue
// borra los datos se ve en el momento y no semanas despues.
const counts = ["contacts", "users", "visits", "management_logs", "activities"]
  .map((t) => {
    const row = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as {
      n: number;
    };
    return `${t}=${row.n}`;
  })
  .join(" ");
console.log(`Datos: ${counts}`);

if (!dbExistedBefore && process.env.NODE_ENV === "production") {
  console.warn(
    [
      "",
      "*** ATENCION: la base de datos no existia al arrancar. ***",
      `Carpeta: ${DB_PATH}`,
      "Si esperabas encontrar clientes aqui, esa carpeta NO es un disco",
      "persistente y cada despliegue borra la informacion.",
      "En Railway: Settings -> Volumes -> New Volume, Mount path /app/data",
      "(o monta el disco donde quieras y define CRM_DATA_DIR con esa ruta).",
      "",
    ].join("\n")
  );
}

sqlite.close();

if (shouldSeed) {
  console.log("\nSeeding demo data...");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cp = require("child_process");
  cp.execSync("npx tsx src/db/seed.ts", { stdio: "inherit", cwd: process.cwd() });
}

console.log("\nAuto-CRM initialized successfully!");
console.log("Run 'npm run dev' to start the development server.");
console.log("Open http://localhost:3000 to access your CRM.");
