export type ActivityType = "call" | "email" | "meeting" | "note" | "follow_up";

export type LeadSource =
  | "redes"
  | "referido"
  | "volanteo"
  | "concesionario"
  | "import"
  | "webhook"
  | "otro";

export type MotorcycleInterest = "boxer_ct100_ks" | "boxer_ct100_es";

export type NextAction = "call" | "whatsapp";

export type VisitResult = "aprobado" | "negado" | "sin_proceso";

export type ContactMethod = "whatsapp" | "call";

/** Plan con el que aplica el cliente. */
export type Plan = "asalariado" | "trabajo";

/** Resultado de un intento de gestion. */
export type ManagementOutcome = "contesto" | "no_contesto";

export interface ManagementLog {
  id: string;
  contactId: string;
  method: ContactMethod;
  outcome: ManagementOutcome;
  promisedDate: Date | null;
  note: string | null;
  createdAt: Date;
}

export type Classification =
  | "interesado"
  | "otra_marca"
  | "indeciso"
  | "sin_perfil"
  | "pago_mensual"
  | "otra_ciudad"
  | "sin_cobertura"
  | "no_le_interesa"
  | "moto_nueva";

/** Etapa a la que se mueve el cliente segun su clasificacion. */
export type ClassificationDestination = "Prospecto" | "Perdido" | "Contactado";

export interface Contact {
  id: string;
  name: string;
  stageId: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  identificationNumber: string | null;
  expeditionCity: string | null;
  companionName: string | null;
  motorcycleInterest: string | null;
  company: string | null;
  source: LeadSource;
  score: number;
  notes: string | null;
  contactMethod: ContactMethod | null;
  plan: Plan | null;
  classification: Classification | null;
  classificationDetail: string | null;
  classificationDate: Date | null;
  visitResult: VisitResult | null;
  visitResultDate: Date | null;
  visitResultNote: string | null;
  stageChangedAt: Date | null;
  approvedContactedAt: Date | null;
  approvedContactMethod: ContactMethod | null;
  procedureStartDate: Date | null;
  dealershipAnnouncedAt: Date | null;
  dealershipVisitedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visit {
  id: string;
  contactId: string;
  visitador: string;
  neighborhood: string | null;
  scheduledAt: Date;
  createdAt: Date;
}

export interface Deal {
  id: string;
  title: string;
  value: number; // in cents
  stageId: string;
  contactId: string;
  expectedClose: Date | null;
  probability: number; // 0-100
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  nextAction: NextAction | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  contactId: string;
  dealId: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface CrmConfig {
  business: {
    type: string;
    industry: string;
    teamSize: string;
  };
  pipeline: {
    stages: Array<{
      name: string;
      order: number;
      color: string;
      isWon: boolean;
      isLost: boolean;
      nextAction?: NextAction | null;
    }>;
  };
  leadSources: string[];
  visitadores?: string[];
  preferences: {
    language: "es" | "en";
    theme: "light" | "dark" | "auto";
  };
}

// API response types
export interface DealWithContact extends Deal {
  contact?: Contact;
  stage?: PipelineStage;
  contactName?: string | null;
}

export interface ContactWithDeals extends Contact {
  deals?: Deal[];
  activities?: Activity[];
}

/** Contacto en el tablero, con el visitador de su visita mas reciente. */
export interface PipelineContact extends Contact {
  visitador?: string | null;
  visitScheduledAt?: Date | null;
  /** Resumen del historico de gestiones. */
  managementCount?: number;
  lastManagementOutcome?: ManagementOutcome | null;
  lastManagementMethod?: ContactMethod | null;
}

export interface PipelineColumn extends PipelineStage {
  contacts: PipelineContact[];
  /** Columna calculada (no es una etapa real; sus tarjetas viven en otra columna). */
  virtual?: boolean;
}

export interface DashboardStats {
  totalContacts: number;
  /** Contactos en etapas abiertas (ni ganadas ni perdidas). */
  activeDeals: number;
  /** Contactos que llegaron a "Moto Entregada". */
  entregadas: number;
}
