/**
 * Permisos del CRM.
 *
 * Cada usuario tiene una lista de permisos guardada en la columna
 * `permissions` de la tabla `users` (JSON). El rol es solo una plantilla que
 * rellena esa lista al crear el usuario: despues se puede activar o desactivar
 * cada permiso uno por uno.
 *
 * El super administrador no usa la lista: siempre tiene todo.
 */

export type Permission =
  | "dashboard"
  | "pipeline"
  | "pipeline_mover"
  | "contactos"
  | "contactos_crear"
  | "contactos_editar"
  | "contactos_eliminar"
  | "agenda"
  | "agenda_editar"
  | "actividades"
  | "registros"
  | "configuracion"
  | "usuarios";

export type Role = "super_admin" | "coordinador" | "asesor" | "visitador";

export interface PermissionDef {
  key: Permission;
  label: string;
  description: string;
}

export interface PermissionGroup {
  title: string;
  permissions: PermissionDef[];
}

/**
 * Agrupados como se ven en la pantalla de usuarios: primero a que secciones
 * entra, despues que puede hacer dentro.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Secciones",
    permissions: [
      {
        key: "dashboard",
        label: "Dashboard",
        description: "Ver indicadores, embudo y graficas.",
      },
      {
        key: "pipeline",
        label: "Pipeline",
        description: "Ver el tablero de etapas.",
      },
      {
        key: "contactos",
        label: "Contactos",
        description: "Ver la lista y la ficha de cada cliente.",
      },
      {
        key: "agenda",
        label: "Agenda",
        description: "Ver el calendario de visitas.",
      },
      {
        key: "actividades",
        label: "Actividades",
        description: "Ver llamadas, notas y seguimientos.",
      },
      {
        key: "registros",
        label: "Registros",
        description: "Ver el historial de movimientos y el desempeno del equipo.",
      },
      {
        key: "configuracion",
        label: "Configuracion",
        description: "Ver los ajustes del CRM.",
      },
    ],
  },
  {
    title: "Acciones",
    permissions: [
      {
        key: "pipeline_mover",
        label: "Mover clientes de etapa",
        description: "Arrastrar tarjetas, clasificar, agendar y registrar gestiones.",
      },
      {
        key: "contactos_crear",
        label: "Crear contactos",
        description: "Agregar clientes nuevos e importar desde archivo.",
      },
      {
        key: "contactos_editar",
        label: "Editar contactos",
        description: "Cambiar los datos de un cliente ya creado.",
      },
      {
        key: "contactos_eliminar",
        label: "Eliminar contactos",
        description: "Borrar un cliente y todo su historial. Cuidado con este.",
      },
      {
        key: "agenda_editar",
        label: "Agendar y reprogramar visitas",
        description: "Crear, mover y cancelar visitas del calendario.",
      },
    ],
  },
  {
    title: "Administracion",
    permissions: [
      {
        key: "usuarios",
        label: "Gestionar usuarios",
        description:
          "Crear colaboradores, cambiar sus claves y sus permisos. Solo para el super administrador.",
      },
    ],
  },
];

/** Todas las claves de permiso, en orden de presentacion. */
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

export const PERMISSION_LABELS: Record<Permission, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions).map((p) => [p.key, p.label])
) as Record<Permission, string>;

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super administrador",
  coordinador: "Coordinador",
  asesor: "Asesor comercial",
  visitador: "Visitador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Acceso total. Es el unico que puede crear y editar usuarios.",
  coordinador: "Todo el CRM menos la gestion de usuarios.",
  asesor: "Trabaja el pipeline, los contactos y la agenda.",
  visitador: "Solo consulta la agenda y los datos del cliente que va a visitar.",
};

/** Permisos que trae cada rol al crearlo. Despues se ajustan uno por uno. */
export const ROLE_PRESETS: Record<Role, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  coordinador: ALL_PERMISSIONS.filter((p) => p !== "usuarios"),
  asesor: [
    "dashboard",
    "pipeline",
    "pipeline_mover",
    "contactos",
    "contactos_crear",
    "contactos_editar",
    "agenda",
    "agenda_editar",
    "actividades",
  ],
  visitador: ["pipeline", "contactos", "agenda"],
};

export function isRole(value: unknown): value is Role {
  return (
    value === "super_admin" ||
    value === "coordinador" ||
    value === "asesor" ||
    value === "visitador"
  );
}

export function isPermission(value: unknown): value is Permission {
  return (
    typeof value === "string" && (ALL_PERMISSIONS as string[]).includes(value)
  );
}

/** Deja solo las claves validas de una lista que llego del cliente. */
export function sanitizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<Permission>();
  for (const item of value) if (isPermission(item)) seen.add(item);
  return ALL_PERMISSIONS.filter((p) => seen.has(p));
}

/** Lee la columna `permissions` (texto JSON) de la base de datos. */
export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) return [];
  try {
    return sanitizePermissions(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Forma minima de usuario que basta para decidir permisos. */
export interface PermissionSubject {
  role: string;
  permissions: Permission[];
}

export function hasPermission(
  user: PermissionSubject | null | undefined,
  permission: Permission
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions.includes(permission);
}
