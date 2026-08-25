import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  sessionCookieOptions,
} from "@/lib/auth";
import { normalizeUsername, verifyPassword } from "@/lib/password";
import { toPublicUser } from "@/lib/session";
import { logAction } from "@/lib/audit";

/** Mismo mensaje para usuario inexistente y clave errada: no se filtra cual es. */
const BAD_CREDENTIALS = "Usuario o clave incorrectos";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Peticion invalida" }, { status: 400 });
  }

  const username = normalizeUsername(
    typeof body.username === "string" ? body.username : ""
  );
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Escribe tu usuario y tu clave" },
      { status: 400 }
    );
  }

  const row = db.select().from(users).where(eq(users.username, username)).get();

  if (!row || !verifyPassword(password, row.passwordHash)) {
    return NextResponse.json({ error: BAD_CREDENTIALS }, { status: 401 });
  }

  if (!row.active) {
    return NextResponse.json(
      {
        error:
          "Tu usuario esta desactivado. Pide al administrador que lo habilite.",
      },
      { status: 403 }
    );
  }

  const now = new Date();
  db.update(users)
    .set({ lastLoginAt: now })
    .where(eq(users.id, row.id))
    .run();

  const user = toPublicUser({ ...row, lastLoginAt: now });
  logAction(user, {
    action: "ingreso",
    entity: "sesion",
    entityId: user.id,
    entityLabel: user.name,
    detail: "Inicio sesion",
  });

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(
    SESSION_COOKIE,
    await createSession(row.id),
    sessionCookieOptions(SESSION_MAX_AGE)
  );
  return response;
}
