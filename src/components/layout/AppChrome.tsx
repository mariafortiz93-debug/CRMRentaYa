"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { permissionForPath } from "@/lib/nav";
import { useSession } from "@/lib/session-context";
import { buttonVariants } from "@/components/ui/button";

/** La pantalla de ingreso se muestra sola, sin menu ni encabezado. */
const BARE_ROUTES = ["/login"];

/**
 * Aviso cuando alguien abre por escrito una direccion para la que no tiene
 * permiso. No es una barrera de seguridad: los datos no llegan porque la API
 * responde 403. Esto solo evita dejarlo mirando una pantalla vacia.
 */
function SinAcceso() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Seccion no habilitada</h2>
          <p className="text-sm text-muted-foreground">
            Tu usuario no tiene permiso para entrar aqui. Si lo necesitas,
            pideselo a la directora comercial.
          </p>
        </div>
        <Link
          href="/perfil"
          className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}
        >
          Ir a mis datos
        </Link>
      </div>
    </div>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user, can, isSuperAdmin } = useSession();

  if (BARE_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  const required = permissionForPath(pathname);
  const superAdminRoute = pathname === "/usuarios" || pathname.startsWith("/usuarios/");
  const allowed =
    loading ||
    !user ||
    ((required === null || can(required)) && (!superAdminRoute || isSuperAdmin));

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
          {allowed ? children : <SinAcceso />}
        </main>
      </div>
    </>
  );
}
