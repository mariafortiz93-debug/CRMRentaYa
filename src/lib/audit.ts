/**
 * Etiqueta de autor en cada movimiento.
 *
 * Cada vez que alguien crea, edita, mueve o borra algo, se deja una fila en
 * `audit_logs` con su nombre. De ahi salen la lista y las graficas de la
 * pantalla de Registros.
 *
 * Regla: registrar nunca puede tumbar la operacion real. Si falla el guardado
 * del registro se ignora el error; es preferible perder una linea de historial
 * a perder el dato del cliente.
 */

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { SessionUser } from "./session";

export type AuditAction =
  | "crear"
  | "editar"
  | "eliminar"
  | "mover"
  | "agendar"
  | "gestionar"
  | "importar"
  | "ingreso"
  | "salida";

export type AuditEntity =
  | "contacto"
  | "visita"
  | "gestion"
  | "actividad"
  | "usuario"
  | "sesion";

export interface AuditInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  /** Nombre del cliente o del registro afectado. */
  entityLabel?: string | null;
  /** Frase corta en espanol con lo que paso. */
  detail?: string | null;
}

/** Autor de la accion. Acepta null para los casos sin sesion (login fallido). */
type Author = Pick<SessionUser, "id" | "name"> | null;

export function logAction(author: Author, input: AuditInput): void {
  try {
    db.insert(auditLogs)
      .values({
        userId: author?.id ?? null,
        userName: author?.name ?? "Desconocido",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        detail: input.detail ?? null,
        createdAt: new Date(),
      })
      .run();
  } catch {
    // El historial es secundario: nunca debe romper la operacion del usuario.
  }
}

/**
 * Compara dos versiones de un registro y describe en espanol que campos
 * cambiaron, para que el detalle del historial sea util y no solo "edito".
 */
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): string {
  const changed: string[] = [];

  for (const [field, label] of Object.entries(labels)) {
    if (!(field in after)) continue;

    const prev = normalize(before[field]);
    const next = normalize(after[field]);
    if (prev === next) continue;

    changed.push(next ? `${label}: ${next}` : `${label}: (vacio)`);
  }

  if (changed.length === 0) return "Sin cambios";
  return changed.join(" · ");
}

function normalize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return String(value.getTime());
  return String(value);
}
