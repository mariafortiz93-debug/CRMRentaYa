/**
 * Lectura del usuario que hizo la peticion, y control de permisos.
 *
 * Aqui esta la frontera de seguridad de verdad: cada ruta de API vuelve a leer
 * el usuario de la base de datos, asi que si el super administrador quita un
 * permiso o desactiva a alguien, el cambio aplica en la siguiente peticion sin
 * esperar a que la persona vuelva a entrar.
 *
 * Solo corre en Node (toca la base). El middleware usa `auth.ts`.
 */

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { one } from "@/db/one";
import { users } from "@/db/schema";
import { SESSION_COOKIE, readSession } from "./auth";
import {
  parsePermissions,
  hasPermission,
  type Permission,
  type Role,
} from "./permissions";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Lo que se puede mandar al navegador: nunca incluye el hash de la clave. */
export interface PublicUser extends SessionUser {
  updatedAt: Date;
}

type UserRow = typeof users.$inferSelect;

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as Role,
    permissions: parsePermissions(row.permissions),
    active: row.active,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Usuario de la sesion actual, o null si no hay sesion valida o esta inactivo. */
export async function getSessionUser(
  request?: NextRequest
): Promise<SessionUser | null> {
  const raw = request
    ? request.cookies.get(SESSION_COOKIE)?.value
    : (await cookies()).get(SESSION_COOKIE)?.value;

  const userId = await readSession(raw);
  if (!userId) return null;

  const row = (await one(db.select().from(users).where(eq(users.id, userId))));
  if (!row || !row.active) return null;

  return toPublicUser(row);
}

type Guard =
  | { ok: true; user: SessionUser }
  | { ok: false; error: NextResponse };

/** Exige una sesion valida, sin pedir ningun permiso en particular. */
export async function requireUser(request?: NextRequest): Promise<Guard> {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      ok: false,
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

/**
 * Exige una sesion valida y un permiso concreto.
 *
 * Uso en una ruta:
 *   const auth = await requirePermission("contactos_crear");
 *   if (!auth.ok) return auth.error;
 *   // auth.user es el colaborador que hizo la accion
 */
export async function requirePermission(
  permission: Permission,
  request?: NextRequest
): Promise<Guard> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;

  if (!hasPermission(auth.user, permission)) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "No tienes permiso para esta accion" },
        { status: 403 }
      ),
    };
  }
  return auth;
}

/** Exige que sea el super administrador. */
export async function requireSuperAdmin(
  request?: NextRequest
): Promise<Guard> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;

  if (auth.user.role !== "super_admin") {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Solo el super administrador puede hacer esto" },
        { status: 403 }
      ),
    };
  }
  return auth;
}
