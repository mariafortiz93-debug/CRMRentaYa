import type {
  LeadSource,
  ActivityType,
  MotorcycleInterest,
  NextAction,
  VisitResult,
  ContactMethod,
  Classification,
  ClassificationDestination,
  Plan,
  ManagementOutcome,
  ManagementReason,
} from "@/types";

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

export const CONTACT_METHOD_CONFIG: Record<
  ContactMethod,
  { label: string; color: string; bgColor: string }
> = {
  whatsapp: { label: "Por WhatsApp", color: "#15803d", bgColor: "#dcfce7" },
  call: { label: "Por llamada", color: "#1d4ed8", bgColor: "#dbeafe" },
};

export const PLAN_CONFIG: Record<
  Plan,
  { label: string; color: string; bgColor: string }
> = {
  asalariado: { label: "Plan Asalariado", color: "#1d4ed8", bgColor: "#dbeafe" },
  trabajo: { label: "Plan Trabajo", color: "#7c3aed", bgColor: "#ede9fe" },
};

export const MANAGEMENT_OUTCOME_CONFIG: Record<
  ManagementOutcome,
  { label: string; color: string; bgColor: string }
> = {
  contesto: { label: "Contesto", color: "#15803d", bgColor: "#dcfce7" },
  no_contesto: { label: "No contesto", color: "#b91c1c", bgColor: "#fee2e2" },
};

/**
 * Motivos por los que un cliente aprobado aun no inicia el tramite.
 * `losesClient` marca los que sacan al cliente del embudo.
 */
export const MANAGEMENT_REASON_CONFIG: Record<
  ManagementReason,
  {
    label: string;
    color: string;
    bgColor: string;
    detailLabel?: string;
    losesClient?: boolean;
  }
> = {
  sin_dinero: {
    label: "No tiene el valor inicial completo",
    color: "#a16207",
    bgColor: "#fef9c3",
  },
  acompanante: {
    label: "El acompañante no ha tenido disponibilidad",
    color: "#c2410c",
    bgColor: "#ffedd5",
  },
  documentacion: {
    label: "Documentacion incompleta (RUNT / notaria)",
    color: "#7c3aed",
    bgColor: "#ede9fe",
  },
  novedad_personal: {
    label: "Novedad personal (tiempo, calamidad, disponibilidad)",
    color: "#0f766e",
    bgColor: "#ccfbf1",
  },
  desistio: {
    label: "Desistio del proceso",
    color: "#b91c1c",
    bgColor: "#fee2e2",
    losesClient: true,
  },
  otra: {
    label: "Otra",
    color: "#475569",
    bgColor: "#f1f5f9",
    detailLabel: "Cual es el motivo?",
  },
};

export const MANAGEMENT_REASON_ORDER: ManagementReason[] = [
  "sin_dinero",
  "acompanante",
  "documentacion",
  "novedad_personal",
  "desistio",
  "otra",
];

/**
 * Clasificacion del cliente al ser contactado.
 * `detailLabel` pide un dato extra; `destination` define a donde se mueve despues.
 */
export const CLASSIFICATION_CONFIG: Record<
  Classification,
  {
    label: string;
    color: string;
    bgColor: string;
    detailLabel?: string;
    destination: ClassificationDestination;
  }
> = {
  interesado: {
    label: "Interesado",
    color: "#15803d",
    bgColor: "#dcfce7",
    destination: "Contactado",
  },
  moto_nueva: {
    label: "Moto nueva",
    color: "#15803d",
    bgColor: "#dcfce7",
    detailLabel: "Que modelo de moto le interesa?",
    destination: "Prospecto",
  },
  pago_mensual: {
    label: "Pago mensual",
    color: "#0f766e",
    bgColor: "#ccfbf1",
    destination: "Prospecto",
  },
  indeciso: {
    label: "Indeciso",
    color: "#a16207",
    bgColor: "#fef9c3",
    destination: "Prospecto",
  },
  otra_marca: {
    label: "Otra marca",
    color: "#c2410c",
    bgColor: "#ffedd5",
    detailLabel: "Que otra marca?",
    destination: "Perdido",
  },
  otra_ciudad: {
    label: "Otra ciudad",
    color: "#7c3aed",
    bgColor: "#ede9fe",
    detailLabel: "En que ciudad esta ubicado?",
    destination: "Perdido",
  },
  sin_perfil: {
    label: "Sin perfil",
    color: "#b91c1c",
    bgColor: "#fee2e2",
    destination: "Perdido",
  },
  sin_cobertura: {
    label: "Sin cobertura",
    color: "#b91c1c",
    bgColor: "#fee2e2",
    destination: "Perdido",
  },
  no_le_interesa: {
    label: "No le interesa",
    color: "#b91c1c",
    bgColor: "#fee2e2",
    destination: "Perdido",
  },
};

export const CLASSIFICATION_ORDER: Classification[] = [
  "interesado",
  "moto_nueva",
  "pago_mensual",
  "indeciso",
  "otra_marca",
  "otra_ciudad",
  "sin_perfil",
  "sin_cobertura",
  "no_le_interesa",
];

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
