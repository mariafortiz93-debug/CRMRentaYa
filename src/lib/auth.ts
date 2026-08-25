/**
 * Sesion del CRM.
 *
 * Cada persona entra con su propio usuario y clave (tabla `users`). La sesion
 * es una cookie firmada con HMAC-SHA256 que solo guarda el id del usuario y la
 * fecha de vencimiento.
 *
 * Este archivo usa unicamente Web Crypto para que funcione tanto en el
 * middleware (que corre en Edge) como en el servidor. La verificacion de la
 * clave y la lectura de permisos viven en `session.ts` y `password.ts`, que si
 * tocan la base de datos y solo corren en Node.
 *
 * Regla importante: los permisos NO viajan en la cookie. El middleware solo
 * comprueba que la sesion sea valida; quien decide que puede hacer cada
 * persona son las rutas de API, que leen el usuario de la base en cada
 * peticion. Asi, si el super administrador le quita un permiso a alguien, el
 * cambio aplica de inmediato sin esperar a que vuelva a entrar.
 */

/**
 * Nombre nuevo de la cookie. Se cambio a proposito al pasar de la clave
 * compartida a usuarios individuales: las sesiones viejas quedan invalidadas y
 * todo el mundo vuelve a entrar con su usuario.
 */
export const SESSION_COOKIE = "crm_sesion_v2";

/** Duracion de la sesion: 30 dias. */
const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/**
 * Lee la variable en tiempo de ejecucion.
 *
 * Se usa acceso por corchetes con una clave en variable a proposito: si se
 * escribiera `process.env.X` directamente, el empaquetador puede reemplazarlo
 * por su valor al construir la imagen. Como la imagen se construye antes de
 * que el hosting inyecte la variable, quedaria congelada en `undefined`.
 */
export function readEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}

function secret(): string {
  return (
    readEnv("CRM_SESSION_SECRET") ||
    readEnv("CRM_PASSWORD") ||
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
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Crea el valor de la cookie de sesion para un usuario. */
export async function createSession(userId: string): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}:${expires}`;
  return `${payload}.${await sign(payload)}`;
}

/**
 * Valida la cookie y devuelve el id del usuario, o null si la firma no cuadra
 * o la sesion ya vencio.
 */
export async function readSession(
  cookie: string | undefined
): Promise<string | null> {
  if (!cookie) return null;

  const dot = cookie.lastIndexOf(".");
  if (dot < 1) return null;

  const payload = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  if (!safeEqual(mac, await sign(payload))) return null;

  const sep = payload.lastIndexOf(":");
  if (sep < 1) return null;

  const userId = payload.slice(0, sep);
  const expires = Number(payload.slice(sep + 1));
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;

  return userId;
}

/** Opciones con las que se escribe y se borra la cookie de sesion. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: readEnv("NODE_ENV") === "production",
    path: "/",
    maxAge,
  };
}
