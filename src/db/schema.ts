import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/**
 * Colaboradores que entran al CRM. Cada uno con su usuario y su clave.
 *
 * `role` es solo la plantilla con la que se creo; lo que manda de verdad es
 * `permissions`, un JSON con la lista de permisos activos (ver
 * `src/lib/permissions.ts`). El super administrador ignora la lista: puede
 * todo, y es el unico que administra usuarios.
 */
export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Con el que inicia sesion. Siempre en minusculas y sin espacios. */
    username: text("username").notNull(),
    /** Nombre para mostrar en las etiquetas de cada movimiento. */
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("asesor"),
    /** JSON con la lista de permisos activos. */
    permissions: text("permissions").notNull().default("[]"),
    /** Un usuario desactivado no puede entrar, pero su historial se conserva. */
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /** Avisa que todavia usa la clave que le asignaron. */
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("idx_users_username").on(table.username)]
);

/**
 * Registro de cada movimiento que se hace en el CRM: quien lo hizo, que hizo y
 * sobre que cliente.
 *
 * A proposito no tiene claves foraneas hacia `users` ni hacia `contacts`: el
 * historial debe sobrevivir al borrado de un contacto o de un colaborador. Por
 * eso guarda tambien el nombre del usuario y una etiqueta del registro
 * afectado, copiados en el momento de la accion.
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id"),
    /** Nombre del colaborador tal como estaba al hacer la accion. */
    userName: text("user_name").notNull(),
    /** crear | editar | eliminar | mover | agendar | gestionar | importar | ingreso | salida */
    action: text("action").notNull(),
    /** contacto | visita | gestion | actividad | usuario | sesion */
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    /** Nombre del cliente o del registro afectado, para leerlo sin consultas. */
    entityLabel: text("entity_label"),
    /** Frase en espanol con lo que paso. */
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_audit_logs_created_at").on(table.createdAt),
    index("idx_audit_logs_user_id").on(table.userId),
  ]
);

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
  /** Por que aun no inicia el tramite. */
  reason: text("reason"),
  reasonDetail: text("reason_detail"),
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
