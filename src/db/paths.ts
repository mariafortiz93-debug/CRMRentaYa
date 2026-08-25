import path from "path";
import fs from "fs";

/**
 * Donde vive la base de datos.
 *
 * TODA la informacion del CRM (clientes, visitas, gestiones, usuarios y el
 * historial) esta en un solo archivo: `crm.db`. Si esa carpeta no sobrevive al
 * despliegue, se pierde todo.
 *
 * Por defecto es `./data`, pero se puede cambiar con `CRM_DATA_DIR`. Eso
 * importa en un hosting como Railway: el disco persistente se monta en una
 * ruta que decide el panel, y si no coincide con `/app/data` el CRM escribiria
 * en el disco temporal del contenedor, que se borra en cada actualizacion.
 * Con esta variable basta apuntarlo a donde este montado el disco.
 */

function readEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}

export function dataDir(): string {
  const custom = readEnv("CRM_DATA_DIR");
  if (custom && custom.trim()) {
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  }
  return path.join(process.cwd(), "data");
}

export function dbPath(): string {
  return path.join(dataDir(), "crm.db");
}

/** Crea la carpeta si no existe. Devuelve la ruta. */
export function ensureDataDir(): string {
  const dir = dataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
