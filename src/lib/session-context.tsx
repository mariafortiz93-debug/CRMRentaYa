"use client";

/**
 * Quien esta conectado, visto desde el navegador.
 *
 * Se consulta `/api/auth/me` una vez al cargar la aplicacion y de ahi salen el
 * menu lateral, el nombre que se muestra arriba y los botones que se ocultan.
 *
 * Esto es solo comodidad visual: la seguridad de verdad esta en las rutas de
 * API, que releen los permisos de la base en cada peticion. Ocultar un boton
 * no impide nada por si solo; el servidor es el que dice que no.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { User } from "@/types";

interface SessionValue {
  user: User | null;
  /** True mientras todavia no sabemos quien es. */
  loading: boolean;
  /** True si el usuario tiene ese permiso (el super admin siempre). */
  can: (permission: Permission) => boolean;
  isSuperAdmin: boolean;
  /** Vuelve a leer el usuario, por ejemplo tras cambiar los datos propios. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  loading: true,
  can: () => false,
  isSuperAdmin: false,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const can = useCallback(
    (permission: Permission) => hasPermission(user, permission),
    [user]
  );

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        can,
        isSuperAdmin: user?.role === "super_admin",
        refresh,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
