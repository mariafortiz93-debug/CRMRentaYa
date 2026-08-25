import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

/**
 * Corre en Edge, asi que no puede tocar la base de datos: aqui solo se
 * comprueba que la cookie de sesion tenga una firma valida y no haya vencido.
 *
 * Los permisos por seccion NO se deciden aqui. De eso se encargan las rutas de
 * API, que releen al usuario de la base en cada peticion (`lib/session.ts`).
 */

/** Rutas que se pueden ver sin haber iniciado sesion. */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const userId = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();

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
