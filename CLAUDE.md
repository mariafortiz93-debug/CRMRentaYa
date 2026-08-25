# CLAUDE.md — CRM Renta Ya Motocicletas

> **Este archivo es la memoria del proyecto.** Claude Code lo carga solo al
> iniciar cualquier sesion nueva, asi que aqui vive todo el contexto.
>
> **REGLA PARA CLAUDE: cada vez que hagas un cambio que altere el
> funcionamiento, el modelo de datos, el despliegue o los pendientes,
> actualiza este archivo en el mismo commit.** Manten la seccion
> "Historial de cambios" al dia. Si algo aqui ya no es cierto, corrigelo.

---

## El negocio

**Renta Ya Motocicletas** — alquiler de motos con opcion de compra, en
Cartagena (Colombia).

- **Motos**: Boxer CT100 KS y Boxer CT100 ES
- **Planes**: Asalariado y Trabajo
- **Fuentes de leads**: redes, referido, volanteo, concesionario, otro
- **Visitadores** (hacen visitas a domicilio): Richard, Hugo, Jaime
- **Equipo**: Oscar, Kelly, Richard, Katia y Maria (directora comercial)
- **Idioma**: todo en espanol. Sin tildes en el codigo y los textos de UI,
  para evitar problemas de codificacion.

---

## Estado actual

| | |
|---|---|
| **En produccion** | https://crmrentaya-production-b3bf.up.railway.app |
| **Hosting** | Railway (despliega solo al hacer push a `main`) |
| **Repositorio activo** | https://github.com/mariafortiz93-debug/CRMRentaYa (remote `crmrentaya`) |
| **Repositorio antiguo** | `mariafortiz93-debug/auto-crm-motos` (remote `mine`) — duplicado, se puede borrar |
| **Plantilla original** | `Hainrixz/auto-crm` (remote `origin`) — ya no se usa |

### Pendientes importantes

1. **Volumen persistente en Railway** — SIN CONFIRMAR. Settings → Volumes con
   *Mount path* = `/app/data`. **Sin esto, cada despliegue borra todos los
   datos de clientes.** Es lo mas critico del proyecto.
2. **Cambiar `CRM_PASSWORD`** — hoy es `RentaYa2026`, una clave provisional que
   quedo escrita en conversaciones.
3. **Repositorio publico** — el codigo es visible para cualquiera. Los datos de
   clientes NO estan en el repo, pero conviene pasarlo a privado.
4. **Compartir con el equipo** — pendiente repartir enlace y clave a los 5.

---

## Flujo comercial (el pipeline)

11 etapas, definidas en `crm-config.json`:

| # | Etapa | Que pasa ahi |
|---|-------|--------------|
| 1 | **Prospecto** | Entra el lead. Solo se piden **nombre y telefono**. |
| 2 | **Contactado** | Al mover aqui se pregunta si fue por WhatsApp o llamada. Se clasifica al cliente y se marca su **plan**. |
| 3 | **Visita al Concesionario** | El cliente dijo que iria. Boton "Marcar asistencia" para registrar si fue. |
| 4 | **Registro Online** | Boton "Diligenciar formulario": se completan **todos** los datos. Al guardar pasa solo a Agendar Visita. |
| 5 | **Agendar Visita** | Se asigna visitador, fecha, hora y barrio. Alerta roja a los **2 dias** sin agendar. |
| 6 | **Visita** | Visita agendada. Se puede reprogramar. |
| 7 | **Visitas Reagendadas** | Clientes que no contestaron y hay que volver a llamar. |
| 8 | **Estado de la Visita** | Se marca **Aprobado / Negado / Sin proceso**. Negado y Sin proceso exigen motivo. |
| — | **Clientes Aprobados** | **Columna calculada, no es una etapa real.** Muestra los aprobados de la etapa 8; aparecen en ambas columnas. Aqui se gestionan las llamadas. |
| 9 | **Inicio de Tramite** | El cliente arranco el proceso de compra. |
| 10 | **Moto Entregada** | Venta cerrada (`isWon`). |
| 11 | **Perdido** | Fuera del embudo (`isLost`). |

### Clasificacion del cliente (etapa Contactado)

Cada una define a donde se mueve el cliente al guardar:

| Clasificacion | Pide detalle | Destino |
|---|---|---|
| Interesado | — | Se queda en Contactado |
| Moto nueva | Que modelo | Prospecto |
| Pago mensual | — | Prospecto |
| Indeciso | — | Prospecto |
| Otra marca | Cual marca | Perdido |
| Otra ciudad | Cual ciudad | Perdido |
| Sin perfil | — | Perdido |
| Sin cobertura | — | Perdido |
| No le interesa | — | Perdido |

### Gestion de aprobados

Cada llamada o WhatsApp queda como **registro historico** (tabla
`management_logs`), no se sobrescribe. Se guarda medio, si contesto, la fecha
que prometio y el motivo por el que aun no inicia:

- No tiene el valor inicial completo
- El acompañante no ha tenido disponibilidad
- Documentacion incompleta (RUNT / notaria)
- Novedad personal (tiempo, calamidad, disponibilidad)
- **Desistio del proceso** → mueve el cliente a Perdido automaticamente
- Otra (texto libre)

Alerta roja a los **3 dias** sin gestionar.

---

## Arquitectura

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript strict ·
Tailwind CSS v4 · shadcn/ui · SQLite + Drizzle ORM · @dnd-kit

**Alias**: `@/*` → `./src/*`

### Directorios

- `src/app/` — paginas y API routes
- `src/components/pipeline/` — tablero, tarjetas y dialogos del pipeline
- `src/components/contacts/` — tabla, ficha y formulario de contactos
- `src/components/dashboard/` — KPIs, embudo, graficas
- `src/db/` — `schema.ts`, `index.ts` (cliente), `stages.ts` (etapas)
- `src/lib/` — `constants.ts` (etiquetas), `auth.ts`, `dateRange.ts`
- `scripts/init.ts` — crea tablas y etapas. Corre al arrancar el contenedor.

### Modelo de datos

**contacts** — el centro de todo. El contacto avanza por el pipeline el mismo
(`stage_id`); los "deals" quedaron sin uso real.

Campos propios del negocio: `phone2`, `address`, `city`, `neighborhood`,
`identification_number`, `expedition_city`, `companion_name`,
`motorcycle_interest`, `plan`, `source`, `contact_method`, `classification` +
`classification_detail`, `visit_result` + `visit_result_note` + fecha,
`stage_changed_at` (para las alertas por dias), `approved_contacted_at` +
`approved_contact_method`, `procedure_start_date`,
`dealership_announced_at` + `dealership_visited_at`.

**pipeline_stages** — nombre, orden, color, `is_won`, `is_lost`,
`next_action` (llamar / whatsapp). Indice unico sobre `name`.

**visits** — contacto, visitador, barrio, fecha y hora.

**management_logs** — historico de gestiones a aprobados: medio, resultado,
fecha prometida, motivo y observacion.

**activities** — llamadas, notas y seguimientos.

### API Routes

| Endpoint | Metodos | Descripcion |
|---|---|---|
| `/api/contacts` | GET, POST | Listar y crear. Al crear asigna la primera etapa. |
| `/api/contacts/[id]` | GET, PUT, DELETE | CRUD. El DELETE borra primero actividades, gestiones, visitas y deals. |
| `/api/pipeline` | GET, PUT | Tablero; mover contacto de etapa. |
| `/api/visits` · `/api/visits/[id]` | GET, POST, PUT, DELETE | Agendar y reprogramar visitas. |
| `/api/managements` | GET, POST | Historico de gestiones. `?contactId=` filtra. |
| `/api/export` | GET | `?type=contacts` (solo campos del formulario), `visit-states`, `visit-results`. |
| `/api/import-visit-states` | POST | Importa estados desde CSV, identifica por cedula. |
| `/api/auth/login` · `/logout` | POST | Acceso con clave compartida. |
| `/api/activities`, `/api/followups`, `/api/import`, `/api/webhook`, `/api/digest` | varios | Heredados de la plantilla. |

### Acceso

Clave compartida en `CRM_PASSWORD`. Sesion en cookie firmada con HMAC-SHA256
(Web Crypto, funciona en middleware Edge y en servidor). `src/middleware.ts`
protege todo menos `/login` y `/api/auth/*`.

- En **produccion la clave es obligatoria**: si falta, no entra nadie (falla
  cerrado, para no exponer datos por un olvido).
- En **local sin clave no pide login**, para no estorbar el uso diario.
- Las variables se leen **en tiempo de ejecucion** (`readEnv()` en `auth.ts`).
  No usar `process.env.X` directo: el empaquetador lo congela al construir la
  imagen, antes de que el hosting inyecte la variable.

---

## Comandos

```bash
npm run dev      # desarrollo en http://localhost:3000
npm run build    # build de produccion
npm run init     # crea tablas y etapas
npm run lint     # ESLint
npx tsc --noEmit # chequeo de tipos
```

**Antes de cada commit**: `npx tsc --noEmit` y `npm run lint`.

**Si el servidor no arranca** con "Failed to open database / Loading
persistence directory failed": es la cache de Turbopack. `rm -rf .next`.

---

## Reglas de codigo

- Textos de UI **en espanol y sin tildes**
- Iconos con **Lucide React**, nunca emojis
- Formularios con **react-hook-form + zod**
- Drag & drop con **@dnd-kit**
- Fechas: SQLite guarda enteros; se formatean con `Intl.DateTimeFormat("es-CO")`
- Etiquetas y colores centralizados en `src/lib/constants.ts`
- Max ~300 lineas por componente

### Al agregar una columna a la base de datos

Hay que tocar **cuatro** sitios o el despliegue se rompe:

1. `src/db/schema.ts` (Drizzle)
2. `src/db/index.ts` (CREATE TABLE del arranque)
3. `scripts/init.ts` (CREATE TABLE del contenedor)
4. `ALTER TABLE` sobre la base existente, para no perder datos

### Al agregar una tabla que referencia contacts

Agregarla tambien al `DELETE` de `/api/contacts/[id]`, o borrar contactos
fallara por clave foranea. Ya paso dos veces (con `visits` y con
`management_logs`).

---

## Historial de cambios

- **Personalizacion inicial** — se reemplazo el email por los campos del
  negocio (telefono 2, direccion, cedula, acompañante, moto de interes) y se
  quito la "temperatura" del lead.
- **Pipeline por contactos** — el contacto avanza por las etapas el mismo, en
  vez de crear un "deal" con valor en pesos. Las columnas cuentan personas.
- **Agenda de visitas** — visitador, franjas de 1 hora (8am–5pm), barrio,
  calendario mensual y bloqueo de horas ocupadas.
- **Gestion de aprobados** — historico de llamadas con motivos, alertas por
  dias sin gestionar.
- **Dashboard** — embudo de conversion, conversion por fuente, clasificaciones,
  filtro por rango de fechas. Se quito el KPI de valor en pesos.
- **Marca** — logo de Renta Ya (extraido del PDF corporativo), favicon y titulo.
- **Acceso con clave** y despliegue en Railway.

### Errores corregidos (no repetirlos)

- **Borrado en cascada de contactos**: el dialogo de confirmacion se cerraba
  *despues* del `await`, y un re-render volvia a disparar el borrado para otras
  filas. Se borraron todos los contactos una vez. Ahora se captura el objetivo,
  se cierra el dialogo antes del `await` y hay un `useRef` que bloquea
  reentradas.
- **Etapas duplicadas**: la siembra corria en cada worker de Next.js con una
  comprobacion no atomica, y sembraba las etapas genericas de la plantilla.
  Ahora `ensurePipelineStages()` es idempotente, une duplicados reasignando
  contactos, y un indice unico lo impide.
- **Clave "no configurada" en Railway**: `process.env.CRM_PASSWORD` se
  congelaba al construir la imagen. Se lee en tiempo de ejecucion.
- **Docker sin clave**: `.dockerignore` excluye `.env*` (correcto), pero
  `docker-compose.yml` no pasaba la variable. Ahora usa `env_file`.
- **Borrado con dependencias**: faltaba borrar `visits` y `management_logs`.

---

## Recuperar datos borrados

La base esta en modo WAL, asi que `data/crm.db-wal` guarda versiones
anteriores. Se recupera truncando la WAL a un punto previo:

1. Copiar `crm.db` y `crm.db-wal` a otra carpeta (nunca trabajar sobre los
   originales)
2. Leer el tamano de pagina en el byte 8 de la WAL; cada frame mide
   `24 + pageSize`
3. Ir recortando la WAL a N frames y abrir la copia hasta encontrar el punto
   con los datos intactos
4. Insertar esas filas de vuelta en la base viva

Ya se uso con exito para recuperar 6 contactos, 5 visitas y 9 actividades.
