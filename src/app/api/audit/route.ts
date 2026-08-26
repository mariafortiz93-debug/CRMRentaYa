import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { fetchAuditReport } from "@/lib/audit-query";

/**
 * Historial de movimientos con el resumen de desempeno por colaborador.
 *
 * Filtros por query string:
 *   ?from=2026-08-01&to=2026-08-25  periodo
 *   ?userId=...                     un colaborador
 *   ?action=mover                   un tipo de accion
 *   ?limit=500                      cuantas filas devolver
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("registros", request);
  if (!auth.ok) return auth.error;

  const { searchParams } = new URL(request.url);

  return NextResponse.json(
    await fetchAuditReport({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      userId: searchParams.get("userId") || undefined,
      action: searchParams.get("action") || undefined,
      limit: Number(searchParams.get("limit")) || undefined,
    })
  );
}
