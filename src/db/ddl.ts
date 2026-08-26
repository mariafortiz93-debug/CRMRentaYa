/**
 * Creacion de las tablas en PostgreSQL.
 *
 * Corre al arrancar el contenedor (`scripts/init.ts`). Solo crea lo que falte:
 * nunca borra ni vacia nada.
 *
 * **Al agregar una columna nueva basta con ponerla en dos sitios**: en
 * `schema.ts` (para Drizzle) y en la lista `EXTRA_COLUMNS` de abajo. Postgres
 * entiende `ADD COLUMN IF NOT EXISTS`, asi que la columna aparece sola en la
 * base que ya existe, sin perder datos. En SQLite habia que tocar cuatro
 * sitios y armar el `ALTER TABLE` a mano.
 */

import type { Pool } from "pg";

const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'asesor',
    permissions TEXT NOT NULL DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    entity_label TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`,

  `CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b',
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    next_action TEXT
  )`,
  // Impide que dos procesos arrancando a la vez dejen etapas repetidas.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_stages_name ON pipeline_stages(name)`,

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
    classification_date TIMESTAMPTZ,
    visit_result TEXT,
    visit_result_date TIMESTAMPTZ,
    visit_result_note TEXT,
    stage_changed_at TIMESTAMPTZ,
    approved_contacted_at TIMESTAMPTZ,
    approved_contact_method TEXT,
    procedure_start_date TIMESTAMPTZ,
    dealership_announced_at TIMESTAMPTZ,
    dealership_visited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS management_logs (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    method TEXT NOT NULL,
    outcome TEXT NOT NULL,
    promised_date TIMESTAMPTZ,
    reason TEXT,
    reason_detail TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    visitador TEXT NOT NULL,
    neighborhood TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    stage_id TEXT NOT NULL REFERENCES pipeline_stages(id),
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    expected_close TIMESTAMPTZ,
    probability INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    deal_id TEXT REFERENCES deals(id),
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS crm_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

/**
 * Columnas agregadas despues de la primera version. Se aplican sobre bases que
 * ya existian; en una recien creada no hacen nada.
 */
const EXTRA_COLUMNS: Array<[table: string, column: string, type: string]> = [
  // Ejemplo para la proxima vez:
  // ["contacts", "referido_por", "TEXT"],
];

/** Nombres de las tablas del CRM, en orden seguro para borrar (hijas primero). */
export const TABLES_IN_DELETE_ORDER = [
  "audit_logs",
  "activities",
  "management_logs",
  "visits",
  "deals",
  "contacts",
  "pipeline_stages",
  "users",
  "crm_settings",
];

export async function ensureSchema(pool: Pool): Promise<void> {
  for (const sql of TABLES) {
    await pool.query(sql);
  }
  for (const [table, column, type] of EXTRA_COLUMNS) {
    await pool.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`
    );
  }
}
