import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pipelineStages = sqliteTable("pipeline_stages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("#64748b"),
  isWon: integer("is_won", { mode: "boolean" }).notNull().default(false),
  isLost: integer("is_lost", { mode: "boolean" }).notNull().default(false),
  nextAction: text("next_action"),
});

export const contacts = sqliteTable("contacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  stageId: text("stage_id").references(() => pipelineStages.id),
  phone: text("phone"),
  phone2: text("phone2"),
  address: text("address"),
  city: text("city"),
  neighborhood: text("neighborhood"),
  identificationNumber: text("identification_number"),
  expeditionCity: text("expedition_city"),
  companionName: text("companion_name"),
  motorcycleInterest: text("motorcycle_interest"),
  company: text("company"),
  source: text("source").notNull().default("otro"),
  score: integer("score").notNull().default(0),
  notes: text("notes"),
  contactMethod: text("contact_method"), // whatsapp | call
  plan: text("plan"), // asalariado | trabajo
  classification: text("classification"), // otra_marca | indeciso | ...
  classificationDetail: text("classification_detail"), // marca / ciudad / modelo
  classificationDate: integer("classification_date", { mode: "timestamp" }),
  visitResult: text("visit_result"), // aprobado | negado | sin_proceso
  visitResultDate: integer("visit_result_date", { mode: "timestamp" }),
  visitResultNote: text("visit_result_note"),
  /** Cuando entro a la etapa actual (para las alertas de dias sin gestion). */
  stageChangedAt: integer("stage_changed_at", { mode: "timestamp" }),
  /** Gestion de la llamada al cliente aprobado. */
  approvedContactedAt: integer("approved_contacted_at", { mode: "timestamp" }),
  approvedContactMethod: text("approved_contact_method"), // whatsapp | call
  /** Fecha en que el cliente dijo que iniciara el tramite. */
  procedureStartDate: integer("procedure_start_date", { mode: "timestamp" }),
  /** Concesionario: cuando anuncio que iria y cuando asistio. */
  dealershipAnnouncedAt: integer("dealership_announced_at", { mode: "timestamp" }),
  dealershipVisitedAt: integer("dealership_visited_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Historico de gestiones a clientes aprobados: cada llamada o WhatsApp que se
 * hace para recordarles iniciar el tramite, con lo que respondio el cliente.
 */
export const managementLogs = sqliteTable("management_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  method: text("method").notNull(), // whatsapp | call
  outcome: text("outcome").notNull(), // contesto | no_contesto
  /** Fecha en que el cliente dijo que iniciaria el tramite. */
  promisedDate: integer("promised_date", { mode: "timestamp" }),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const visits = sqliteTable("visits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  visitador: text("visitador").notNull(),
  neighborhood: text("neighborhood"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const deals = sqliteTable("deals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  value: integer("value").notNull().default(0),
  stageId: text("stage_id")
    .notNull()
    .references(() => pipelineStages.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  expectedClose: integer("expected_close", { mode: "timestamp" }),
  probability: integer("probability").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const activities = sqliteTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  description: text("description").notNull(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  dealId: text("deal_id").references(() => deals.id),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const crmSettings = sqliteTable("crm_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
