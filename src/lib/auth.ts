/**
 * Acceso al CRM con una clave compartida.
 *
 * - La clave se define en la variable de entorno CRM_PASSWORD.
 * - En produccion la clave es obligatoria: si falta, no se deja entrar a nadie
 *   (falla cerrado) para no exponer datos de clientes por un olvido.
 * - En desarrollo local, si no hay CRM_PASSWORD, no se pide clave.
 *
 * La sesion es una cookie firmada con HMAC-SHA256 usando Web Crypto, para que
 * funcione tanto en el middleware (Edge) como en el servidor.
 */

export const SESSION_COOKIE = "crm_sesion";

/** Duracion de la sesion: 30 dias. */
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function secret(): string {
  return (
    process.env.CRM_SESSION_SECRET ||
    process.env.CRM_PASSWORD ||
    "clave-de-desarrollo-local"
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return toHex(mac);
}

/** Comparacion en tiempo constante para no filtrar informacion por el tiempo. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Clave configurada, o null si no hay ninguna. */
export function configuredPassword(): string | null {
  const p = process.env.CRM_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/** True si hay que pedir clave para entrar. */
export function authRequired(): boolean {
  return configuredPassword() !== null || process.env.NODE_ENV === "production";
}

/** Crea el valor de la cookie de sesion. */
export async function createSession(): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = String(expires);
  return `${payload}.${await sign(payload)}`;
}

/** Valida la cookie: firma correcta y sin vencer. */
export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false;
  const dot = cookie.lastIndexOf(".");
  if (dot < 1) return false;

  const payload = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  if (!safeEqual(mac, await sign(payload))) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}

/** Verifica la clave que escribio el usuario. */
export function passwordMatches(input: string): boolean {
  const expected = configuredPassword();
  if (!expected) return false;
  return safeEqual(input, expected);
}
