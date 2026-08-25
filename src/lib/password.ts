/**
 * Guardado y verificacion de claves.
 *
 * Las claves nunca se guardan como texto: se guarda un resumen con scrypt y
 * una sal aleatoria distinta para cada usuario. Aunque alguien se lleve el
 * archivo `crm.db`, no puede leer las claves.
 *
 * Formato guardado: `scrypt$<sal en hex>$<resumen en hex>`
 *
 * Este archivo usa `node:crypto`, asi que solo se puede importar desde rutas
 * de API y scripts (Node), nunca desde el middleware (Edge).
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

/** Reglas minimas de una clave. Devuelve el error o null si esta bien. */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "La clave debe tener al menos 8 caracteres";
  }
  if (password.length > 200) {
    return "La clave es demasiado larga";
  }
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, expected] = parts;
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, KEY_LENGTH);
  } catch {
    return false;
  }

  const expectedBuf = Buffer.from(expected, "hex");
  if (expectedBuf.length !== actual.length) return false;
  return timingSafeEqual(expectedBuf, actual);
}

/** Normaliza el nombre de usuario: minusculas y sin espacios. */
export function normalizeUsername(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** Reglas del nombre de usuario. Devuelve el error o null si esta bien. */
export function validateUsername(username: string): string | null {
  if (username.length < 3) {
    return "El usuario debe tener al menos 3 caracteres";
  }
  if (username.length > 40) {
    return "El usuario es demasiado largo";
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return "El usuario solo puede tener letras, numeros, punto, guion y guion bajo";
  }
  return null;
}
