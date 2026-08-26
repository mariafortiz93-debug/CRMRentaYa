/**
 * Donde vive la base de datos.
 *
 * Ya no es un archivo dentro del contenedor: es un servicio de PostgreSQL
 * aparte. Esa fue justamente la causa de que cada despliegue dejara el CRM en
 * blanco: Railway no actualiza el contenedor, lo reemplaza, y `crm.db` se iba
 * con el. Una base separada sobrevive a los despliegues por si sola, sin
 * discos que montar ni rutas que configurar.
 *
 * La direccion viene en **`DATABASE_URL`**, que Railway inyecta solo al
 * conectar el servicio de Postgres. `CRM_DATABASE_URL` sirve para apuntar a
 * otra base sin tocar la que pone el hosting.
 *
 * Se lee **en tiempo de ejecucion**: con `process.env.X` directo, el
 * empaquetador congela el valor al construir la imagen, antes de que el
 * hosting inyecte las variables. Ya paso con la clave de acceso.
 */

function readEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}

export function databaseUrl(): string {
  const url = readEnv("CRM_DATABASE_URL") || readEnv("DATABASE_URL");
  if (!url || !url.trim()) {
    throw new Error(
      "Falta DATABASE_URL. En Railway: New -> Database -> PostgreSQL, y " +
        "conecta ese servicio al del CRM para que la inyecte. En local, " +
        "define DATABASE_URL en .env.local."
    );
  }
  return url.trim();
}

/**
 * Dentro de Railway el trafico va por la red interna y no lleva TLS. Hacia
 * afuera si, y el certificado lo firma la propia plataforma, asi que no se
 * puede validar contra una autoridad publica.
 */
export function sslOption(url: string): false | { rejectUnauthorized: boolean } {
  const local =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes(".railway.internal");
  return local ? false : { rejectUnauthorized: false };
}

/** Version corta y sin credenciales, para los mensajes del log. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(direccion no reconocida)";
  }
}
