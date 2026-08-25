import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (user) {
    logAction(user, {
      action: "salida",
      entity: "sesion",
      entityId: user.id,
      entityLabel: user.name,
      detail: "Cerro sesion",
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
