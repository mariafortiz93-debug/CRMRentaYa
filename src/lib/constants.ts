import type { LeadSource, ActivityType, MotorcycleInterest, NextAction, VisitResult } from "@/types";

export const SOURCE_LABELS: Record<LeadSource, string> = {
  redes: "Redes sociales",
  referido: "Referido",
  volanteo: "Volanteo",
  concesionario: "Concesionario",
  import: "Importado",
  webhook: "Webhook",
  otro: "Otro",
};

export const MOTORCYCLE_LABELS: Record<MotorcycleInterest, string> = {
  boxer_ct100_ks: "Boxer CT100 KS",
  boxer_ct100_es: "Boxer CT100 ES",
};

export const NEXT_ACTION_CONFIG: Record<NextAction, { label: string; icon: string }> = {
  call: { label: "Llamar", icon: "Phone" },
  whatsapp: { label: "Enviar WhatsApp", icon: "MessageCircle" },
};

export const VISIT_RESULT_CONFIG: Record<
  VisitResult,
  { label: string; color: string; bgColor: string }
> = {
  aprobado: { label: "Aprobado", color: "#15803d", bgColor: "#dcfce7" },
  sin_proceso: { label: "Sin proceso", color: "#a16207", bgColor: "#fef9c3" },
  negado: { label: "Negado", color: "#b91c1c", bgColor: "#fee2e2" },
};

export const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { label: string; icon: string }
> = {
  call: { label: "Llamada", icon: "Phone" },
  email: { label: "Email", icon: "Mail" },
  meeting: { label: "Reunion", icon: "Users" },
  note: { label: "Nota", icon: "FileText" },
  follow_up: { label: "Seguimiento", icon: "Clock" },
};

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}

export function cleanPhoneForWhatsApp(phone: string): string {
  // "+52 55 1234 5678" → "525512345678"
  return phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
}

function toDate(date: Date | number): Date {
  if (date instanceof Date) return date;
  // If number is less than 1e12, it's in seconds; otherwise milliseconds
  return new Date(date < 1e12 ? date * 1000 : date);
}

export function formatDate(date: Date | number | null): string {
  if (!date) return "-";
  const d = toDate(date);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatRelativeDate(date: Date | number): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  return formatDate(date);
}
