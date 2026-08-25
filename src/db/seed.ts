import Database from "better-sqlite3";
import { dbPath, ensureDataDir } from "./paths";

ensureDataDir();
const DB_PATH = dbPath();

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

console.log("Seeding database...");

// Get pipeline stages
const stages = sqlite
  .prepare('SELECT id, name FROM pipeline_stages ORDER BY "order"')
  .all() as Array<{ id: string; name: string }>;

if (stages.length === 0) {
  console.error(
    "No pipeline stages found. Run the app first to create default stages."
  );
  process.exit(1);
}

const stageMap = new Map(stages.map((s) => [s.name, s.id]));
const now = Math.floor(Date.now() / 1000);
const day = 86400;

// Seed contacts
const contacts = [
  {
    id: crypto.randomUUID(),
    name: "Maria Garcia",
    stage_id: stageMap.get("Inicio de Tramite") || stages[0].id,
    phone: "+57 300 1234567",
    phone2: "+57 300 1234567",
    address: "Calle 10 # 5-20",
    city: "Bogota",
    neighborhood: "Chapinero",
    identification_number: "1020304050",
    expedition_city: "Bogota",
    companion_name: null,
    motorcycle_interest: "boxer_ct100_ks",
    company: null,
    source: "redes",
    score: 85,
    notes: "Interesada en alquiler con opcion de compra. Quiere iniciar tramite pronto.",
    created_at: now - 5 * day,
    updated_at: now - 1 * day,
  },
  {
    id: crypto.randomUUID(),
    name: "Carlos Rodriguez",
    stage_id: stageMap.get("Visita al Concesionario") || stages[0].id,
    phone: "+57 310 9876543",
    phone2: null,
    address: "Carrera 45 # 12-30",
    city: "Medellin",
    neighborhood: "Belen",
    identification_number: "1030405060",
    expedition_city: "Medellin",
    companion_name: "Diana Rodriguez",
    motorcycle_interest: "boxer_ct100_es",
    company: null,
    source: "referido",
    score: 60,
    notes: "Referido por un cliente actual. Agendo visita al concesionario.",
    created_at: now - 10 * day,
    updated_at: now - 3 * day,
  },
  {
    id: crypto.randomUUID(),
    name: "Ana Martinez",
    stage_id: stageMap.get("Prospecto") || stages[0].id,
    phone: "+57 315 5551234",
    phone2: "+57 315 5551234",
    address: "Avenida 6 # 20-15",
    city: "Cali",
    neighborhood: "San Fernando",
    identification_number: "1040506070",
    expedition_city: "Cali",
    companion_name: null,
    motorcycle_interest: "boxer_ct100_ks",
    company: null,
    source: "volanteo",
    score: 55,
    notes: "Recibio volante en el barrio. Pregunto por precios y requisitos.",
    created_at: now - 7 * day,
    updated_at: now - 2 * day,
  },
  {
    id: crypto.randomUUID(),
    name: "Roberto Sanchez",
    stage_id: stageMap.get("Estado de la Visita") || stages[0].id,
    phone: "+57 320 7778888",
    phone2: null,
    address: "Calle 80 # 30-40",
    city: "Bogota",
    neighborhood: "Suba",
    identification_number: "1050607080",
    expedition_city: "Bogota",
    companion_name: null,
    motorcycle_interest: "boxer_ct100_es",
    company: null,
    source: "concesionario",
    score: 25,
    notes: "Visito el concesionario pero aun no decide.",
    created_at: now - 15 * day,
    updated_at: now - 15 * day,
  },
  {
    id: crypto.randomUUID(),
    name: "Laura Hernandez",
    stage_id: stageMap.get("Inicio de Tramite") || stages[0].id,
    phone: "+57 300 4445555",
    phone2: "+57 301 4445555",
    address: "Carrera 15 # 8-50",
    city: "Barranquilla",
    neighborhood: "El Prado",
    identification_number: "1060708090",
    expedition_city: "Barranquilla",
    companion_name: "Jorge Hernandez",
    motorcycle_interest: "boxer_ct100_ks",
    company: null,
    source: "redes",
    score: 90,
    notes: "Muy interesada, quiere iniciar tramite esta semana.",
    created_at: now - 3 * day,
    updated_at: now,
  },
];

const insertContact = sqlite.prepare(
  `INSERT OR IGNORE INTO contacts (
     id, name, stage_id, phone, phone2, address, city, neighborhood,
     identification_number, expedition_city, companion_name, motorcycle_interest,
     company, source, score, notes, created_at, updated_at
   )
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const c of contacts) {
  insertContact.run(
    c.id,
    c.name,
    c.stage_id,
    c.phone,
    c.phone2,
    c.address,
    c.city,
    c.neighborhood,
    c.identification_number,
    c.expedition_city,
    c.companion_name,
    c.motorcycle_interest,
    c.company,
    c.source,
    c.score,
    c.notes,
    c.created_at,
    c.updated_at
  );
}

console.log(`Created ${contacts.length} contacts`);

// Seed deals
const dealData = [
  {
    id: crypto.randomUUID(),
    title: "Plan Empresarial - TechStartup MX",
    value: 250000, // $2,500.00
    stage_id: stageMap.get("Propuesta") || stages[2].id,
    contact_id: contacts[0].id,
    expected_close: now + 15 * day,
    probability: 70,
    notes: "Enviamos propuesta. Esperando respuesta del director.",
    created_at: now - 4 * day,
    updated_at: now - 1 * day,
  },
  {
    id: crypto.randomUUID(),
    title: "CRM Personalizado - Inmobiliaria",
    value: 180000, // $1,800.00
    stage_id: stageMap.get("Contactado") || stages[1].id,
    contact_id: contacts[1].id,
    expected_close: now + 30 * day,
    probability: 40,
    notes: "Primera llamada realizada. Agendamos demo para la proxima semana.",
    created_at: now - 8 * day,
    updated_at: now - 3 * day,
  },
  {
    id: crypto.randomUUID(),
    title: "Servicio Premium - Agencia Creativa",
    value: 450000, // $4,500.00
    stage_id: stageMap.get("Negociacion") || stages[3].id,
    contact_id: contacts[4].id,
    expected_close: now + 7 * day,
    probability: 85,
    notes: "Negociando precio. Muy probable que cierre esta semana.",
    created_at: now - 2 * day,
    updated_at: now,
  },
];

const insertDeal = sqlite.prepare(
  `INSERT OR IGNORE INTO deals (id, title, value, stage_id, contact_id, expected_close, probability, notes, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const d of dealData) {
  insertDeal.run(
    d.id,
    d.title,
    d.value,
    d.stage_id,
    d.contact_id,
    d.expected_close,
    d.probability,
    d.notes,
    d.created_at,
    d.updated_at
  );
}

console.log(`Created ${dealData.length} deals`);

// Seed activities
const activityData = [
  {
    id: crypto.randomUUID(),
    type: "email",
    description:
      "Envio de propuesta comercial con pricing y features del plan empresarial.",
    contact_id: contacts[0].id,
    deal_id: dealData[0].id,
    scheduled_at: null,
    completed_at: now - 2 * day,
    created_at: now - 2 * day,
  },
  {
    id: crypto.randomUUID(),
    type: "call",
    description:
      "Llamada de introduccion. Carlos mostro interes en automatizar su proceso.",
    contact_id: contacts[1].id,
    deal_id: dealData[1].id,
    scheduled_at: null,
    completed_at: now - 5 * day,
    created_at: now - 5 * day,
  },
  {
    id: crypto.randomUUID(),
    type: "meeting",
    description:
      "Reunion presencial en evento de networking. Intercambiamos tarjetas.",
    contact_id: contacts[4].id,
    deal_id: dealData[2].id,
    scheduled_at: null,
    completed_at: now - 3 * day,
    created_at: now - 3 * day,
  },
  {
    id: crypto.randomUUID(),
    type: "follow_up",
    description:
      "Dar seguimiento a Maria sobre la propuesta enviada. Preguntar si tiene dudas.",
    contact_id: contacts[0].id,
    deal_id: dealData[0].id,
    scheduled_at: now + 1 * day,
    completed_at: null,
    created_at: now,
  },
  {
    id: crypto.randomUUID(),
    type: "follow_up",
    description: "Agendar demo con Carlos para mostrar el CRM personalizado.",
    contact_id: contacts[1].id,
    deal_id: dealData[1].id,
    scheduled_at: now + 3 * day,
    completed_at: null,
    created_at: now,
  },
  {
    id: crypto.randomUUID(),
    type: "note",
    description:
      "Roberto parece no estar listo para comprar. Agregar a newsletter y dar seguimiento en 30 dias.",
    contact_id: contacts[3].id,
    deal_id: null,
    scheduled_at: null,
    completed_at: now - 10 * day,
    created_at: now - 10 * day,
  },
];

const insertActivity = sqlite.prepare(
  `INSERT OR IGNORE INTO activities (id, type, description, contact_id, deal_id, scheduled_at, completed_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const a of activityData) {
  insertActivity.run(
    a.id,
    a.type,
    a.description,
    a.contact_id,
    a.deal_id,
    a.scheduled_at,
    a.completed_at,
    a.created_at
  );
}

console.log(`Created ${activityData.length} activities`);
console.log("Seed complete!");

sqlite.close();
