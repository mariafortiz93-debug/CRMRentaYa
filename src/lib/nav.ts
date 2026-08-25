import {
  LayoutDashboard,
  Users,
  Kanban,
  Activity,
  Settings,
  Briefcase,
  CalendarDays,
  ClipboardList,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "./permissions";

/**
 * Menu del CRM. Una sola definicion para el menu lateral y el del celular.
 *
 * `permission` decide quien ve cada entrada. `superAdminOnly` marca las que
 * son exclusivas del super administrador aunque el permiso se pudiera activar.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  superAdminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, permission: "pipeline" },
  { href: "/contacts", label: "Contactos", icon: Users, permission: "contactos" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, permission: "agenda" },
  { href: "/deals", label: "Deals", icon: Briefcase, permission: "contactos" },
  {
    href: "/activities",
    label: "Actividades",
    icon: Activity,
    permission: "actividades",
  },
  {
    href: "/registros",
    label: "Registros",
    icon: ClipboardList,
    permission: "registros",
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: UserCog,
    permission: "usuarios",
    superAdminOnly: true,
  },
  {
    href: "/settings",
    label: "Configuracion",
    icon: Settings,
    permission: "configuracion",
  },
];

/**
 * Rutas que cualquiera con sesion puede ver, sin permiso especial.
 * `/perfil` esta aqui porque todo el mundo debe poder cambiar su propia clave.
 */
export const ALWAYS_ALLOWED = ["/perfil", "/login"];

/** El permiso que exige una ruta, o null si no exige ninguno. */
export function permissionForPath(pathname: string): Permission | null {
  if (ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  // La coincidencia mas larga gana, para que "/contacts/123" no caiga en "/".
  const match = NAV_ITEMS.filter(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href + "/"))
  ).sort((a, b) => b.href.length - a.href.length)[0];

  return match?.permission ?? null;
}
