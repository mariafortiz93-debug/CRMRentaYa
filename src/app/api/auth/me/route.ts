import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

/**
 * Quien esta conectado y que permisos tiene ahora mismo.
 *
 * La interfaz lo consulta al cargar para decidir que secciones mostrar. Se lee
 * siempre de la base, no de la cookie, para que un cambio de permisos se note
 * en cuanto la persona recargue.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(user);
}
