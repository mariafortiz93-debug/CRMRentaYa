import type { Pool } from "pg";
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

export async function ensureSuperAdmin(pool: Pool): Promise<void> {
  const existing = await pool.query<{ n: string }>(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'"
  );

  if (Number(existing.rows[0].n) > 0) return;

  const username = (readEnv("CRM_ADMIN_USER") || DEFAULT_ADMIN_USERNAME)
    .trim()
    .toLowerCase();
  const password = readEnv("CRM_ADMIN_PASSWORD") || DEFAULT_ADMIN_PASSWORD;
  const name = readEnv("CRM_ADMIN_NAME") || DEFAULT_ADMIN_NAME;

  const now = new Date();
  const permissions = JSON.stringify(ROLE_PRESETS.super_admin);

  // Si ese nombre de usuario ya existe con otro rol, lo ascendemos en vez de
  // chocar contra el indice unico.
  const sameName = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE username = $1",
    [username]
  );

  if (sameName.rows.length > 0) {
    await pool.query(
      `UPDATE users
       SET role = 'super_admin', permissions = $1, active = TRUE, updated_at = $2
       WHERE id = $3`,
      [permissions, now, sameName.rows[0].id]
    );
    return;
  }

  await pool.query(
    `INSERT INTO users
       (id, username, name, password_hash, role, permissions, active,
        must_change_password, last_login_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'super_admin', $5, TRUE, TRUE, NULL, $6, $6)`,
    [
      crypto.randomUUID(),
      username,
      name,
      hashPassword(password),
      permissions,
      now,
    ]
  );
}

/**
 * Llave de repuesto: super administrador de emergencia.
 *
 * `ensureSuperAdmin` solo actua cuando **no hay ninguno**, asi que si la
 * directora comercial pierde su clave, o alguien desactiva su usuario por
 * error, no queda forma de volver a entrar: el CRM no manda correos y nadie
 * mas puede administrar usuarios.
 *
 * Esta funcion cubre ese hueco desde el panel del hosting, sin tocar el
 * codigo. Definiendo `CRM_RECOVERY_USER` y `CRM_RECOVERY_PASSWORD`, en el
 * siguiente arranque ese usuario queda activo y con rol de super
 * administrador (se crea, o se reactiva y se le pone esa clave).
 *
 * A diferencia de la siembra normal, **si pisa la clave**, y lo hace en cada
 * arranque mientras las dos variables sigan puestas. Por eso hay que quitarlas
 * en cuanto se recupere el acceso: mientras esten, esa clave se puede volver a
 * imponer. Entra marcado con `must_change_password`, asi que el CRM obliga a
 * cambiarla al primer ingreso.
 *
 * No degrada ni desactiva a nadie mas: solo agrega o repara ese usuario.
 */
export async function ensureRecoveryAdmin(pool: Pool): Promise<void> {
  const username = (readEnv("CRM_RECOVERY_USER") || "").trim().toLowerCase();
  const password = readEnv("CRM_RECOVERY_PASSWORD") || "";
  if (!username || !password) return;

  const name = readEnv("CRM_RECOVERY_NAME") || "Acceso de emergencia";
  const now = new Date();
  const permissions = JSON.stringify(ROLE_PRESETS.super_admin);
  const hash = hashPassword(password);

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE username = $1",
    [username]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users
       SET role = 'super_admin', permissions = $1, active = TRUE,
           password_hash = $2, must_change_password = TRUE, updated_at = $3
       WHERE id = $4`,
      [permissions, hash, now, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO users
         (id, username, name, password_hash, role, permissions, active,
          must_change_password, last_login_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'super_admin', $5, TRUE, TRUE, NULL, $6, $6)`,
      [crypto.randomUUID(), username, name, hash, permissions, now]
    );
  }

  // Queda en el log del hosting, nunca la clave: asi se ve que la llave de
  // repuesto sigue activa y hay que quitar las variables.
  console.warn(
    `[CRM] Acceso de emergencia activo para el usuario "${username}". ` +
      "Entra, cambia la clave y borra CRM_RECOVERY_USER y CRM_RECOVERY_PASSWORD."
  );
}
