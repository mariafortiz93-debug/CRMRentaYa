import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
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
  ROLE_LABELS,
  ROLE_PRESETS,
  isRole,
  sanitizePermissions,
  type Role,
} from "@/lib/permissions";
import { logAction } from "@/lib/audit";

/** Lista de colaboradores. Solo la ve el super administrador. */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.error;

  const rows = (await db.select().from(users).orderBy(asc(users.name)));
  return NextResponse.json(rows.map(toPublicUser));
}

/** Crear un colaborador nuevo. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const requestedRole: unknown = body.role;
  const role: Role = isRole(requestedRole) ? requestedRole : "asesor";

  if (!name) {
    return NextResponse.json(
      { error: "El nombre del colaborador es requerido" },
      { status: 400 }
    );
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const taken = (await one(db.select().from(users).where(eq(users.username, username))));
  if (taken) {
    return NextResponse.json(
      { error: `El usuario "${username}" ya existe` },
      { status: 409 }
    );
  }

  // Si no mandan permisos explicitos, se usan los del rol como punto de partida.
  const permissions =
    body.permissions === undefined
      ? ROLE_PRESETS[role]
      : sanitizePermissions(body.permissions);

  const now = new Date();
  const created = (await oneOrFail(db
    .insert(users)
    .values({
      username,
      name,
      passwordHash: hashPassword(password),
      role,
      permissions: JSON.stringify(permissions),
      active: body.active === undefined ? true : Boolean(body.active),
      // Le asignaron la clave: conviene que la cambie al entrar.
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    ));

  logAction(auth.user, {
    action: "crear",
    entity: "usuario",
    entityId: created.id,
    entityLabel: created.name,
    detail: `Creo el usuario "${username}" como ${ROLE_LABELS[role]}`,
  });

  return NextResponse.json(toPublicUser(created), { status: 201 });
}
