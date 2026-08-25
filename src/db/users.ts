import type Database from "better-sqlite3";
import crypto from "crypto";
import { hashPassword } from "../lib/password";
import { ROLE_PRESETS } from "../lib/permissions";

/**
 * Siembra del super administrador.
 *
 * Sin esto, al pasar de la clave compartida a usuarios individuales nadie
 * podria entrar: no habria ningun usuario en la base. Esta funcion crea uno la
 * primera vez y despues no vuelve a tocar nada.
 *
 * Es idempotente y no pisa claves: si ya existe un super administrador, se
 * sale sin hacer nada. Asi, cambiar la clave desde el CRM no se deshace en el
 * siguiente despliegue.
 */

/** Credenciales sugeridas si no se definen por variables de entorno. */
export const DEFAULT_ADMIN_USERNAME = "maria";
export const DEFAULT_ADMIN_PASSWORD = "RentaYa2026*";
const DEFAULT_ADMIN_NAME = "Maria Ortiz";

function readEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}

export function ensureSuperAdmin(db: Database.Database): void {
  const existing = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'")
    .get() as { n: number };

  if (existing.n > 0) return;

  const username = (readEnv("CRM_ADMIN_USER") || DEFAULT_ADMIN_USERNAME)
    .trim()
    .toLowerCase();
  const password = readEnv("CRM_ADMIN_PASSWORD") || DEFAULT_ADMIN_PASSWORD;
  const name = readEnv("CRM_ADMIN_NAME") || DEFAULT_ADMIN_NAME;

  // Si ese nombre de usuario ya existe con otro rol, lo ascendemos en vez de
  // chocar contra el indice unico.
  const sameName = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as { id: string } | undefined;

  const now = Date.now();
  const permissions = JSON.stringify(ROLE_PRESETS.super_admin);

  if (sameName) {
    db.prepare(
      `UPDATE users
       SET role = 'super_admin', permissions = ?, active = 1, updated_at = ?
       WHERE id = ?`
    ).run(permissions, now, sameName.id);
    return;
  }

  db.prepare(
    `INSERT INTO users
       (id, username, name, password_hash, role, permissions, active,
        must_change_password, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'super_admin', ?, 1, 1, NULL, ?, ?)`
  ).run(
    crypto.randomUUID(),
    username,
    name,
    hashPassword(password),
    permissions,
    now,
    now
  );
}
