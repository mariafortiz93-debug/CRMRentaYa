import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authRequired, isValidSession } from "@/lib/auth";

/** Rutas que se pueden ver sin haber iniciado sesion. */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function middleware(request: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const ok = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  // Las llamadas de datos responden 401 en vez de redirigir.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?destino=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Excluye estaticos e imagenes; protege todo lo demas.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.png$).*)"],
};
