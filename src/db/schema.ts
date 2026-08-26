/**
 * Esquema en PostgreSQL.
 *
 * Antes esto era SQLite, un archivo (`crm.db`) que vivia dentro del mismo
 * contenedor que la aplicacion. Railway no actualiza el contenedor: lo
 * reemplaza, asi que cada despliegue se llevaba la base por delante. Ahora la
 * base es un servicio aparte y sobrevive a los despliegues por si sola.
 *
 * Diferencias que hay que tener presentes al tocar este archivo:
 *  - Las fechas son `timestamp` de verdad, no enteros. Drizzle sigue
 *    entregando y recibiendo objetos `Date`.
 *  - Los si/no son `boolean`, no enteros 0/1.
 *  - Las consultas son **asincronas**: siempre `await`, y devuelven arreglos.
 *    Para quedarse con una sola fila esta `one()`, en `src/db/one.ts`.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Colaboradores que entran al CRM. Cada uno con su usuario y su clave.
 *
 * `role` es solo la plantilla con la que se creo; lo que manda de verdad es
 * `permissions`, un JSON con la lista de permisos activos (ver
 * `src/lib/permissions.ts`). El super administrador ignora la lista: puede
 * todo, y es el unico que administra usuarios.
 */
export const users = pgTable(
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
    active: boolean("active").notNull().default(true),
    /** Avisa que todavia usa la clave que le asignaron. */
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
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
export const auditLogs = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_audit_logs_created_at").on(table.createdAt),
    index("idx_audit_logs_user_id").on(table.userId),
  ]
);

export const pipelineStages = pgTable("pipeline_stages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("#64748b"),
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
  nextAction: text("next_action"),
});

export const contacts = pgTable("contacts", {
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
  classificationDate: timestamp("classification_date", { withTimezone: true }),
  visitResult: text("visit_result"), // aprobado | negado | sin_proceso
  visitResultDate: timestamp("visit_result_date", { withTimezone: true }),
  visitResultNote: text("visit_result_note"),
  /** Cuando entro a la etapa actual (para las alertas de dias sin gestion). */
  stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }),
  /** Gestion de la llamada al cliente aprobado. */
  approvedContactedAt: timestamp("approved_contacted_at", { withTimezone: true }),
  approvedContactMethod: text("approved_contact_method"), // whatsapp | call
  /** Fecha en que el cliente dijo que iniciara el tramite. */
  procedureStartDate: timestamp("procedure_start_date", { withTimezone: true }),
  /** Concesionario: cuando anuncio que iria y cuando asistio. */
  dealershipAnnouncedAt: timestamp("dealership_announced_at", { withTimezone: true }),
  dealershipVisitedAt: timestamp("dealership_visited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Historico de gestiones a clientes aprobados: cada llamada o WhatsApp que se
 * hace para recordarles iniciar el tramite, con lo que respondio el cliente.
 */
export const managementLogs = pgTable("management_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  method: text("method").notNull(), // whatsapp | call
  outcome: text("outcome").notNull(), // contesto | no_contesto
  /** Fecha en que el cliente dijo que iniciaria el tramite. */
  promisedDate: timestamp("promised_date", { withTimezone: true }),
  /** Por que aun no inicia el tramite. */
  reason: text("reason"),
  reasonDetail: text("reason_detail"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const visits = pgTable("visits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  visitador: text("visitador").notNull(),
  neighborhood: text("neighborhood"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const deals = pgTable("deals", {
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
  expectedClose: timestamp("expected_close", { withTimezone: true }),
  probability: integer("probability").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const activities = pgTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  description: text("description").notNull(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  dealId: text("deal_id").references(() => deals.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const crmSettings = pgTable("crm_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
