import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  configuredPassword,
  createSession,
  passwordMatches,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Peticion invalida" }, { status: 400 });
  }

  if (!configuredPassword()) {
    return NextResponse.json(
      {
        error:
          "Este servidor no tiene clave configurada. Define CRM_PASSWORD donde " +
          "se esta ejecutando el CRM: en Docker con env_file, y en un hosting " +
          "como variable de entorno. El archivo .env.local de tu computador no " +
          "viaja con la aplicacion.",
      },
      { status: 500 }
    );
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
