import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { databaseUrl, sslOption } from "./paths";

/**
 * Conexion a PostgreSQL.
 *
 * Las tablas y la siembra (etapas y super administrador) **no se hacen aqui**:
 * las hace `scripts/init.ts`, que corre una sola vez al arrancar el contenedor
 * (`CMD` del Dockerfile) y en local con `npm run init`. Antes se hacian al
 * importar este archivo, y como Next levanta varios procesos, todos competian
 * por sembrar lo mismo: asi aparecieron las etapas duplicadas.
 *
 * El grupo de conexiones se guarda en `globalThis` porque en desarrollo Next
 * recarga los modulos en cada cambio, y sin esto cada recarga abriria un grupo
 * nuevo hasta agotar las conexiones que permite Postgres.
 */

const globalForDb = globalThis as unknown as { crmPool?: Pool };

function createPool(): Pool {
  const url = databaseUrl();
  return new Pool({
    connectionString: url,
    ssl: sslOption(url),
    // Railway limita las conexiones; el CRM es para un equipo pequeno.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
}

export const pool: Pool = globalForDb.crmPool ?? createPool();
if (!globalForDb.crmPool) globalForDb.crmPool = pool;

// Un error en una conexion inactiva no puede tumbar el proceso.
pool.on("error", (err) => {
  console.error("[CRM] Error en una conexion inactiva de Postgres:", err.message);
});

export const db = drizzle(pool, { schema });

/**
 * El grupo de conexiones crudo.
 *
 * Lo usan los respaldos, que recorren las tablas por nombre en vez de por el
 * esquema de Drizzle.
 */
export const rawDb = pool;
