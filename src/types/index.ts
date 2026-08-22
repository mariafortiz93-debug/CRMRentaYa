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
  visitResult: VisitResult | null;
  procedureStartDate: Date | null;
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

export interface PipelineColumn extends PipelineStage {
  contacts: Contact[];
}

export interface DashboardStats {
  totalContacts: number;
  activeDeals: number;
  totalPipelineValue: number;
  wonDealsValue: number;
  conversionRate: number;
}
