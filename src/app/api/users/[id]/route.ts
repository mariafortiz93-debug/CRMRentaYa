import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { users } from "@/db/schema";
import {
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "@/lib/password";
import { requireSuperAdmin, toPublicUser } from "@/lib/session";
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  isRole,
  parsePermissions,
  sanitizePermissions,
  type Permission,
} from "@/lib/permissions";
import { logAction } from "@/lib/audit";

/** Cuantos super administradores activos quedan aparte de `exceptId`. */
async function otherActiveSuperAdmins(exceptId: string): Promise<number> {
  const rows = (await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "super_admin"),
        eq(users.active, true),
        ne(users.id, exceptId)
      )
    )
    );
  return rows.length;
}

/** Describe en espanol que permisos se activaron y cuales se quitaron. */
function describePermissionChange(
  before: Permission[],
  after: Permission[]
): string | null {
  const added = after.filter((p) => !before.includes(p));
  const removed = before.filter((p) => !after.includes(p));
  if (added.length === 0 && removed.length === 0) return null;

  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`activo ${added.map((p) => PERMISSION_LABELS[p]).join(", ")}`);
  }
  if (removed.length > 0) {
    parts.push(`quito ${removed.map((p) => PERMISSION_LABELS[p]).join(", ")}`);
  }
  return parts.join(" y ");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = (await one(db.select().from(users).where(eq(users.id, id))));
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const updateData: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };
  const changes: string[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }
    if (name !== existing.name) {
      updateData.name = name;
      changes.push(`nombre a "${name}"`);
    }
  }

  if (body.username !== undefined) {
    const username = normalizeUsername(body.username);
    const error = validateUsername(username);
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (username !== existing.username) {
      const taken = (await one(db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        ));
      if (taken) {
        return NextResponse.json(
          { error: `El usuario "${username}" ya existe` },
          { status: 409 }
        );
      }
      updateData.username = username;
      changes.push(`usuario a "${username}"`);
    }
  }

  if (body.role !== undefined) {
    const requestedRole: unknown = body.role;
    if (!isRole(requestedRole)) {
      return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
    }
    if (
      existing.role === "super_admin" &&
      requestedRole !== "super_admin" &&
      (await otherActiveSuperAdmins(id)) === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No puedes quitar el ultimo super administrador: nadie podria administrar usuarios.",
        },
        { status: 400 }
      );
    }
    if (requestedRole !== existing.role) {
      updateData.role = requestedRole;
      changes.push(`rol a ${ROLE_LABELS[requestedRole]}`);
    }
  }

  if (body.permissions !== undefined) {
    const before = parsePermissions(existing.permissions);
    const after = sanitizePermissions(body.permissions);
    const described = describePermissionChange(before, after);
    if (described) {
      updateData.permissions = JSON.stringify(after);
      changes.push(described);
    }
  }

  if (body.active !== undefined) {
    const active = Boolean(body.active);
    if (!active && id === auth.user.id) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propio usuario" },
        { status: 400 }
      );
    }
    if (
      !active &&
      existing.role === "super_admin" &&
      (await otherActiveSuperAdmins(id)) === 0
    ) {
      return NextResponse.json(
        { error: "No puedes desactivar el ultimo super administrador" },
        { status: 400 }
      );
    }
    if (active !== existing.active) {
      updateData.active = active;
      changes.push(active ? "lo activo" : "lo desactivo");
    }
  }

  if (body.password !== undefined && body.password !== "") {
    const error = validatePassword(String(body.password));
    if (error) return NextResponse.json({ error }, { status: 400 });

    updateData.passwordHash = hashPassword(String(body.password));
    // El administrador le asigno una clave; conviene que la cambie al entrar.
    updateData.mustChangePassword = id !== auth.user.id;
    changes.push("le cambio la clave");
  }

  const updated = (await oneOrFail(db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning()
    ));

  if (changes.length > 0) {
    logAction(auth.user, {
      action: "editar",
      entity: "usuario",
      entityId: updated.id,
      entityLabel: updated.name,
      detail: `Cambio ${changes.join(" · ")}`,
    });
  }

  return NextResponse.json(toPublicUser(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.error;

  const { id } = await params;

  const existing = (await one(db.select().from(users).where(eq(users.id, id))));
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "No puedes borrar tu propio usuario" },
      { status: 400 }
    );
  }

  if (existing.role === "super_admin" && (await otherActiveSuperAdmins(id)) === 0) {
    return NextResponse.json(
      { error: "No puedes borrar el ultimo super administrador" },
      { status: 400 }
    );
  }

  // `audit_logs` no tiene clave foranea a `users` a proposito: el historial de
  // lo que hizo esta persona se conserva aunque se borre el usuario.
  await db.delete(users).where(eq(users.id, id));

  logAction(auth.user, {
    action: "eliminar",
    entity: "usuario",
    entityId: existing.id,
    entityLabel: existing.name,
    detail: `Elimino el usuario "${existing.username}"`,
  });

  return NextResponse.json({ success: true });
}
