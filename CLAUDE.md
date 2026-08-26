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

1. **Crear el servicio de PostgreSQL en Railway** — sin el, el CRM no arranca.
   En el panel: `New` → `Database` → `PostgreSQL`, y **conectarlo al servicio
   del CRM** para que inyecte `DATABASE_URL`. Es el reemplazo definitivo del
   disco persistente: la base ya no vive dentro del contenedor, asi que los
   despliegues no la pueden borrar.
2. **Cambiar la clave del super administrador** — al desplegar se crea solo el
   usuario `maria` con la clave `RentaYa2026*`, que quedo escrita en
   conversaciones. Hay que cambiarla desde *Mis datos* al primer ingreso; el
   CRM muestra un aviso amarillo hasta que se haga.
3. **Crear los usuarios del equipo** — Oscar, Kelly, Richard y Katia, desde la
   seccion *Usuarios*, cada uno con sus permisos.
4. **Repositorio publico** — el codigo es visible para cualquiera. Los datos de
   clientes NO estan en el repo, pero conviene pasarlo a privado.

---

## Flujo comercial (el pipeline)

11 etapas, definidas en `crm-config.json`.

Para cambiar de etapa hay **dos caminos**: arrastrar la tarjeta, o el
desplegable *"Mover a otra etapa..."* que trae cada tarjeta. El desplegable no
es un adorno: en celular y en tablet el gesto de arrastrar mueve el tablero en
vez de la tarjeta, y las columnas lejanas quedan fuera de la pantalla. Es un
`<select>` del navegador a proposito, para que se abra nativo en el telefono y
no pelee con el sensor de arrastre.

| # | Etapa | Que pasa ahi |
|---|-------|--------------|
| 1 | **Prospecto** | Entra el lead. Se piden **nombre, telefono y de donde viene**. La fuente se pregunta aqui, sin valor por defecto: es lo que alimenta el conteo por origen y la conversion por fuente. |
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

## Usuarios y permisos

Cada persona entra con **su propio usuario y su propia clave**. Ya no hay clave
compartida.

### Roles

El rol es solo una **plantilla** que rellena la lista de permisos al crear el
usuario. Despues cada permiso se activa o se desactiva uno por uno, asi que dos
personas con el mismo rol pueden tener accesos distintos.

| Rol | Con que permisos nace |
|---|---|
| **Super administrador** | Todo. Es el unico que administra usuarios, y siempre tiene todos los permisos aunque la lista diga otra cosa. |
| **Coordinador** | Todo menos gestionar usuarios. |
| **Asesor comercial** | Dashboard, pipeline, contactos, agenda y actividades. No borra clientes ni ve Registros. |
| **Visitador** | Solo consulta: pipeline, contactos y agenda. |

### Permisos

Definidos en `src/lib/permissions.ts`, agrupados como se ven en pantalla:

- **Secciones** — `dashboard`, `pipeline`, `contactos`, `agenda`,
  `actividades`, `registros`, `configuracion`
- **Acciones** — `pipeline_mover`, `contactos_crear`, `contactos_editar`,
  `contactos_eliminar`, `agenda_editar`
- **Administracion** — `usuarios`

**Donde se aplican de verdad**: en las rutas de API, con
`requirePermission(...)` de `src/lib/session.ts`, que **relee el usuario de la
base en cada peticion**. Por eso, si se le quita un permiso a alguien, el
cambio aplica de inmediato sin esperar a que vuelva a entrar.

Ocultar entradas del menu (`src/lib/nav.ts`) y esconder botones es solo
comodidad visual: **nunca es la barrera**. El middleware tampoco decide
permisos, porque corre en Edge y no puede consultar la base; solo comprueba que
la cookie de sesion sea valida.

### El super administrador

Se siembra solo al arrancar (`src/db/users.ts`), la primera vez que no existe
ninguno. Usuario `maria`, clave `RentaYa2026*`, o lo que digan las variables
`CRM_ADMIN_USER`, `CRM_ADMIN_PASSWORD` y `CRM_ADMIN_NAME`.

**Es idempotente y no pisa claves**: si ya hay un super administrador, no toca
nada. Asi, cambiar la clave desde el CRM no se deshace en el siguiente
despliegue.

No se puede quitar el rol, desactivar ni borrar al ultimo super administrador
activo: si no, nadie podria volver a administrar usuarios.

### Llave de repuesto (quedarse por fuera)

`ensureSuperAdmin` solo actua cuando **no hay ninguno**, asi que si se pierde
la clave del super administrador no habria forma de volver a entrar: el CRM no
manda correos y nadie mas puede administrar usuarios.

Para eso esta `ensureRecoveryAdmin()` (`src/db/users.ts`), que corre en cada
arranque. Definiendo **`CRM_RECOVERY_USER`** y **`CRM_RECOVERY_PASSWORD`** en
el panel del hosting, ese usuario queda activo y con rol de super
administrador: se crea si no existe, y si existe se reactiva y se le pone esa
clave. Opcional: `CRM_RECOVERY_NAME`.

A diferencia de la siembra normal, **si pisa la clave**, y lo hace en cada
arranque mientras las variables sigan puestas. **Hay que borrarlas en cuanto
se recupere el acceso.** Entra con `must_change_password`, asi que el CRM
obliga a cambiarla al primer ingreso, y deja un aviso en el log del hosting
(nunca la clave). No degrada ni desactiva a nadie mas.

---

## Registros (quien hizo cada cosa)

Cada movimiento deja una fila en `audit_logs` con el nombre de quien lo hizo.
Se registra desde las rutas de API con `logAction()` (`src/lib/audit.ts`).

La pantalla `/registros` muestra:

- Arriba, una **grafica de desempeno**: una barra por colaborador, partida en
  colores segun el tipo de movimiento.
- Debajo, la **lista completa**: fecha, colaborador, accion, sobre que registro
  y un detalle en espanol.
- Filtros por periodo, colaborador y tipo de movimiento.

Acciones: `crear`, `editar`, `eliminar`, `mover`, `agendar`, `gestionar`,
`importar`, `ingreso`, `salida`.

**Entrar y salir del CRM aparecen en la lista pero no cuentan en la grafica**:
si contaran, quien mas veces abre la aplicacion pareceria el mas productivo.

Dos decisiones a proposito:

- **`audit_logs` no tiene claves foraneas** hacia `contacts` ni hacia `users`.
  El historial debe sobrevivir al borrado de un cliente o de un colaborador,
  por eso guarda copiados el nombre del usuario y una etiqueta del registro.
  Como efecto util, tampoco hay que agregarla al `DELETE` en cascada.
- **Registrar nunca puede tumbar la operacion real.** Si falla el guardado del
  historial se ignora el error: es preferible perder una linea de historial a
  perder el dato del cliente.

---

## Arquitectura

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript strict ·
Tailwind CSS v4 · shadcn/ui · **PostgreSQL** + Drizzle ORM (`node-postgres`) ·
@dnd-kit

**Alias**: `@/*` → `./src/*`

### Como se consulta la base

Todas las consultas son **asincronas** y devuelven arreglos. No existen
`.get()`, `.all()` ni `.run()`: eso era de SQLite.

```ts
const filas   = await db.select().from(contacts);              // varias
const uno     = await one(db.select().from(contacts).where(...)); // una o undefined
const creado  = await oneOrFail(db.insert(contacts).values(...).returning());
await db.update(contacts).set({ ... }).where(...);             // sin resultado
```

`one()` y `oneOrFail()` estan en `src/db/one.ts`. `oneOrFail` es para INSERT y
UPDATE con `.returning()`, que por definicion devuelven fila.

### Directorios

- `src/app/` — paginas y API routes
- `src/components/pipeline/` — tablero, tarjetas y dialogos del pipeline
- `src/components/contacts/` — tabla, ficha y formulario de contactos
- `src/components/dashboard/` — KPIs, embudo, graficas
- `src/components/users/` — dialogo de crear/editar colaborador
- `src/components/audit/` — grafica de desempeno, filtros y tabla de registros
- `src/db/` — `schema.ts` (tablas en Drizzle), `ddl.ts` (los CREATE TABLE del
  arranque), `index.ts` (grupo de conexiones y cliente), `one.ts` (`one` /
  `oneOrFail`), `paths.ts` (lee `DATABASE_URL`), `stages.ts` (etapas),
  `users.ts` (super administrador y llave de repuesto)
- `src/lib/` — `constants.ts` (etiquetas), `dateRange.ts` y toda la capa de
  acceso:
  - `auth.ts` — firma y lectura de la cookie. **Solo Web Crypto**, porque
    tambien lo usa el middleware en Edge.
  - `password.ts` — scrypt. **Solo Node**, no importarlo desde el middleware.
  - `session.ts` — lee el usuario de la base y aplica los permisos en la API.
  - `session-context.tsx` — el mismo usuario, visto desde el navegador.
  - `permissions.ts` — roles, permisos y plantillas.
  - `nav.ts` — menu y que permiso pide cada ruta.
  - `audit.ts` / `audit-query.ts` — escribir y leer el historial.
- `scripts/init.ts` — crea tablas, etapas y el super administrador. Corre al
  arrancar el contenedor.

### Modelo de datos

**users** — colaboradores: `username` (unico, minusculas), `name`,
`password_hash`, `role`, `permissions` (JSON con la lista), `active`,
`must_change_password`, `last_login_at`.

**audit_logs** — historial de movimientos: `user_id`, `user_name` (copiado),
`action`, `entity`, `entity_id`, `entity_label` (copiado), `detail`,
`created_at`. **Sin claves foraneas, a proposito** (ver arriba).

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
| `/api/export` | GET | `?type=contacts` (campos del formulario + etapa), `visit-states`, `visit-results`. |
| `/api/import-contacts` | POST | Importa contactos desde el CSV que produce el export. Ver abajo. |
| `/api/import-visit-states` | POST | Importa estados desde CSV, identifica por cedula. |
| `/api/auth/login` · `/logout` | POST | Entrar y salir, con usuario y clave. |
| `/api/auth/me` | GET | Quien esta conectado y con que permisos, ahora mismo. |
| `/api/users` · `/api/users/[id]` | GET, POST, PUT, DELETE | Colaboradores. Solo el super administrador. |
| `/api/profile` | PUT | Datos propios. Para cambiar la clave hay que escribir la actual. |
| `/api/audit` | GET | Historial + desempeno. Filtros `from`, `to`, `userId`, `action`, `limit`. |
| `/api/backup` | GET, POST | Descargar y restaurar la base completa. Solo el super administrador. |
| `/api/activities`, `/api/followups`, `/api/import`, `/api/webhook`, `/api/digest` | varios | Heredados de la plantilla. |

Los `deals` siguen sin guardia de permisos porque estan sin uso real; igual
quedan detras del login.

### Acceso

Usuario y clave por persona (tabla `users`). Las claves se guardan con
**scrypt** y una sal distinta por usuario: aunque alguien se lleve `crm.db`, no
puede leerlas.

La sesion es una cookie **`crm_sesion_v2`** firmada con HMAC-SHA256 (Web
Crypto, para que funcione en el middleware Edge y en el servidor) que solo
guarda el id del usuario y el vencimiento. Dura 30 dias.

- `src/middleware.ts` protege todo menos `/login` y `/api/auth/*`, y **solo**
  comprueba que la sesion sea valida. No decide permisos: corre en Edge y no
  puede consultar la base.
- **Los permisos no viajan en la cookie.** Se leen de la base en cada peticion,
  para que un cambio aplique de inmediato.
- El nombre de la cookie cambio a proposito al pasar de la clave compartida:
  invalida las sesiones viejas y obliga a entrar con usuario.
- `CRM_PASSWORD` ya no da acceso. Si sigue definida se usa como semilla del
  secreto de firma, igual que antes; lo ideal es definir
  `CRM_SESSION_SECRET`.
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

Con PostgreSQL son **dos** sitios (con SQLite eran cuatro):

1. `src/db/schema.ts` (Drizzle)
2. La lista `EXTRA_COLUMNS` de `src/db/ddl.ts`

De ahi sale un `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, que Postgres si
entiende, asi que la columna aparece sola en la base que ya existe y sin
perder datos. Si la tabla es nueva, va tambien en `TABLES` de ese mismo
archivo.

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
- **Usuarios, permisos y registros** — se reemplazo la clave compartida por
  usuario y clave por persona, con roles y permisos que el super administrador
  activa uno por uno. Cada movimiento queda etiquetado con quien lo hizo, y la
  pantalla *Registros* muestra la lista y una grafica de desempeno del equipo.
- **Fuente desde el prospecto, y arreglo del embudo** — la fuente se pregunta
  al crear el lead (antes salia todo como "Otro"); "Iniciaron tramite" dejo de
  contar a los clientes perdidos; y cada tarjeta trae un desplegable
  *"Mover a otra etapa..."* para no depender del arrastre.
- **Importar contactos** — el CSV del export se puede volver a subir tal cual
  (*Contactos → Importar*), identificando por cedula o telefono y sin duplicar.
  Ademas, **llave de repuesto** para el acceso: `CRM_RECOVERY_USER` y
  `CRM_RECOVERY_PASSWORD` crean un super administrador de emergencia desde el
  panel del hosting.
- **De SQLite a PostgreSQL** — la base dejo de ser un archivo dentro del
  contenedor y paso a ser un servicio aparte, que sobrevive a los despliegues
  por si solo. Cambio el esquema (fechas y booleanos de verdad), las consultas
  pasaron a ser asincronas (`one()` / `oneOrFail()` en vez de
  `.get()` / `.all()` / `.run()`) y los respaldos pasaron de copiar `crm.db` a
  un JSON con todas las tablas.

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
- **Menu vacio al entrar**: el contexto de sesion del navegador se carga una
  sola vez y no se enteraba de la cookie nueva, asi que tras iniciar sesion no
  aparecia ninguna seccion. El login llama a `refresh()` antes de navegar.
- **Desplegables con el valor crudo**: los `Select` de Base UI pintan el valor,
  no la etiqueta. Se veia "asesor" o "__todos__". Hay que pasarle una funcion a
  `SelectValue` que traduzca el valor.
- **Cada despliegue dejaba el CRM en blanco**: no era un bug del codigo, era
  que la base vivia **dentro del contenedor**, y Railway reemplaza el
  contenedor entero en cada despliegue. Se intento primero con un disco
  persistente; al final se cambio a PostgreSQL, que quita el problema de raiz.
  Regla: **si un dato tiene que sobrevivir al despliegue, no puede vivir
  dentro del contenedor.**
- **Comprobar un despliegue buscando texto en el HTML**: no sirve. Las
  pantallas del CRM las dibuja JavaScript, asi que `curl | grep` da falsos
  negativos. Hay que abrirlo en un navegador de verdad.
- **El embudo contaba a los perdidos como si hubieran iniciado tramite**:
  "Iniciaron tramite" se media con `orden de etapa >= orden de Inicio de
  Tramite`, y **Perdido es la ultima etapa (orden 11)**, o sea mayor que
  Inicio de Tramite (9) y que Moto Entregada (10). Un cliente perdido sumaba
  en los dos pasos finales del embudo. Regla: **medir avance por orden de
  etapa exige excluir siempre las etapas `isLost`**, porque son salidas del
  embudo, no el final del recorrido.
- **La tarjeta que sigue al cursor rompia el arrastre**: el `DragOverlay`
  pintaba un `ContactCard` con **el mismo id** que la tarjeta real, asi que se
  registraba encima de ella en dnd-kit y quedaba como zona de suelte pegada al
  puntero. Ganaba la deteccion de colision y la tarjeta volvia a su columna.
  Lo mismo pasaba con las copias de la columna calculada "Clientes Aprobados".
  Regla: **en dnd-kit, dos nodos jamas pueden compartir id**; las copias y la
  tarjeta del overlay llevan su propio id (`virtual-...`, `overlay-...`) y
  `draggable={false}`.
- **Todos los leads salian como fuente "Otro"**: el formulario de creacion no
  mostraba el desplegable de la fuente y lo mandaba con el valor por defecto
  "otro". Regla: **un campo que alimenta un indicador no puede tener valor por
  defecto**, o nadie lo cambia y el indicador miente.
- **Importar por cedula fusionaba a dos personas distintas**: en las pruebas
  habia dos contactos con la cedula `12345`, y al reimportar el segundo pisaba
  al primero: entraban 5 filas y quedaban 4 clientes, sin ningun aviso. Regla:
  **buscar por un identificador que puede venir mal digitado exige confirmar
  con otro dato** (aqui el nombre) y, si no cuadra, crear aparte y reportarlo.
  Nunca fusionar en silencio.

---
## Persistencia y respaldos

La base es un **servicio de PostgreSQL aparte**, fuera del contenedor del CRM.
`crm-config.json` no se guarda: se regenera desde `public/` en cada arranque.

### Por que se cambio de SQLite

Con SQLite todo vivia en un archivo, `crm.db`, **dentro del contenedor**.
Railway no actualiza el contenedor: lo **reemplaza**, asi que cada despliegue
se llevaba la base por delante. Maria perdio los datos tres veces.

La solucion clasica es montar un disco persistente y apuntar el archivo ahi,
pero depende de escribir bien la ruta en el panel: si no coincide, el CRM
escribe en el disco temporal y **nadie se entera hasta que los datos ya no
estan**. Con una base separada no hay ninguna ruta que equivocar.

Regla que queda: **si un dato tiene que sobrevivir al despliegue, no puede
vivir dentro del contenedor.** Lo mismo vale para archivos subidos, si algun
dia se agregan.

### Conexion

`src/db/paths.ts` lee **`DATABASE_URL`** (o `CRM_DATABASE_URL`) en tiempo de
ejecucion. Railway la inyecta sola al conectar el servicio de Postgres al del
CRM. Sin ella el CRM no arranca, y lo dice con un mensaje claro.

`src/db/index.ts` guarda el grupo de conexiones en `globalThis` porque en
desarrollo Next recarga los modulos en cada cambio, y sin eso cada recarga
abriria un grupo nuevo hasta agotar las conexiones que permite Postgres.

`scripts/init.ts` corre al arrancar el contenedor: crea las tablas que falten,
siembra etapas y super administrador, y deja en el log cuantas filas hay en
cada tabla. Es el **unico** sitio que siembra; antes se hacia al importar el
modulo de la base y los varios procesos de Next competian entre si.

### Respaldos

*Configuracion → Respaldos*, solo para el super administrador. El archivo es un
**JSON** (`crm-respaldo-2026-08-26.json`) con el contenido de todas las tablas.

Es JSON y no un volcado de Postgres porque `pg_dump` no esta dentro del
contenedor, y porque asi el respaldo se puede abrir y revisar sin herramientas
especiales ni depender de la version de Postgres del hosting.

**Restaurar reemplaza todo**, dentro de una sola transaccion: o entra completo
o no entra nada. Detalles que importan:

- Se borra en orden de hijas a padres y se inserta al reves. En Postgres las
  claves foraneas **no se pueden desactivar** sin permisos de administrador,
  asi que el orden es la unica forma.
- Solo se copian las columnas que existen **en los dos lados**, para que un
  respaldo viejo siga sirviendo aunque despues se hayan agregado campos.
- Se insertan 100 filas por sentencia: una por fila seria lentisimo por red.
- Antes de tocar nada se guarda una copia de lo que habia en la carpeta
  temporal del contenedor. **No reemplaza a descargar un respaldo antes de
  restaurar**: esa copia se pierde al reiniciar el servidor.

Los respaldos viejos en formato `.db` (SQLite) **ya no sirven**.

### Segunda red: exportar e importar contactos

*Contactos → Importar*. Solo lleva los campos del formulario y la etapa; las
visitas, las gestiones, los usuarios y el historial solo vuelven con el
respaldo JSON.
