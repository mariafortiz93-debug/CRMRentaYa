/**
 * Consulta del historial de movimientos con el resumen de desempeno.
 *
 * Vive aparte porque la usan dos sitios: la pantalla de Registros (que la
 * llama directo desde el servidor) y `/api/audit`. Asi el conteo por
 * colaborador se calcula igual en los dos.
 */

import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { resolveDateRange } from "./dateRange";

/** Tope de filas que se muestran de una sola vez. */
export const DEFAULT_AUDIT_LIMIT = 300;
export const MAX_AUDIT_LIMIT = 2000;

export interface AuditQueryParams {
  from?: string;
  to?: string;
  userId?: string;
  action?: string;
  limit?: number;
}

export interface PerformanceRow {
  userId: string | null;
  userName: string;
  total: number;
  porAccion: Record<string, number>;
}

export type AuditRow = typeof auditLogs.$inferSelect;

export interface AuditReport {
  logs: AuditRow[];
  total: number;
  limite: number;
  desempeno: PerformanceRow[];
  colaboradores: Array<{ id: string; name: string }>;
}

/**
 * Entrar y salir del CRM queda en la lista, pero no cuenta como trabajo
 * comercial: si contara, quien mas veces abre la aplicacion parece el mas
 * productivo.
 */
const NO_CUENTAN = new Set(["ingreso", "salida"]);

export function fetchAuditReport(params: AuditQueryParams): AuditReport {
  const range = resolveDateRange({ from: params.from, to: params.to });
  const limite = Math.min(
    Math.max(params.limit || DEFAULT_AUDIT_LIMIT, 1),
    MAX_AUDIT_LIMIT
  );

  const filters: SQL[] = [];
  if (range.from) filters.push(gte(auditLogs.createdAt, range.from));
  if (range.to) filters.push(lte(auditLogs.createdAt, range.to));
  if (params.userId) filters.push(eq(auditLogs.userId, params.userId));
  if (params.action) filters.push(eq(auditLogs.action, params.action));

  const rows = db
    .select()
    .from(auditLogs)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .all();

  // El desempeno se calcula sobre TODAS las filas del periodo, no solo sobre
  // las que caben en la pagina: si no, la grafica cambiaria con el limite.
  const byUser = new Map<string, PerformanceRow>();

  for (const row of rows) {
    const key = row.userId || `nombre:${row.userName}`;
    let entry = byUser.get(key);
    if (!entry) {
      entry = {
        userId: row.userId,
        userName: row.userName,
        total: 0,
        porAccion: {},
      };
      byUser.set(key, entry);
    }
    if (NO_CUENTAN.has(row.action)) continue;
    entry.total++;
    entry.porAccion[row.action] = (entry.porAccion[row.action] || 0) + 1;
  }

  const desempeno = [...byUser.values()]
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total);

  const colaboradores = [...byUser.values()]
    .filter((u) => u.userId)
    .map((u) => ({ id: u.userId as string, name: u.userName }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    logs: rows.slice(0, limite),
    total: rows.length,
    limite,
    desempeno,
    colaboradores,
  };
}
