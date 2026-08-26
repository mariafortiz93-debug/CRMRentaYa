import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { one, oneOrFail } from "@/db/one";
import { users } from "@/db/schema";
import {
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "@/lib/password";
import { requireUser, toPublicUser } from "@/lib/session";
import { logAction } from "@/lib/audit";

/**
 * Datos propios: cualquiera puede cambiar su nombre, su usuario y su clave.
 *
 * Para cambiar la clave hay que escribir la actual, asi una sesion abierta y
 * olvidada en otro computador no sirve para quedarse con la cuenta.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existing = (await one(db
    .select()
    .from(users)
    .where(eq(users.id, auth.user.id))
    ));

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
      changes.push("su nombre");
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
      changes.push("su usuario");
    }
  }

  if (body.newPassword) {
    const currentPassword = String(body.currentPassword || "");
    if (!verifyPassword(currentPassword, existing.passwordHash)) {
      return NextResponse.json(
        { error: "La clave actual no es correcta" },
        { status: 400 }
      );
    }

    const newPassword = String(body.newPassword);
    const error = validatePassword(newPassword);
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (verifyPassword(newPassword, existing.passwordHash)) {
      return NextResponse.json(
        { error: "La clave nueva debe ser distinta de la actual" },
        { status: 400 }
      );
    }

    updateData.passwordHash = hashPassword(newPassword);
    updateData.mustChangePassword = false;
    changes.push("su clave");
  }

  if (changes.length === 0) {
    return NextResponse.json(toPublicUser(existing));
  }

  const updated = (await oneOrFail(db
    .update(users)
    .set(updateData)
    .where(eq(users.id, existing.id))
    .returning()
    ));

  logAction(toPublicUser(updated), {
    action: "editar",
    entity: "usuario",
    entityId: updated.id,
    entityLabel: updated.name,
    detail: `Actualizo ${changes.join(" y ")}`,
  });

  return NextResponse.json(toPublicUser(updated));
}
