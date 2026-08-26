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

1. **Volumen persistente en Railway** — **CONFIRMADO QUE FALTA.** Maria reporto
   que cada actualizacion deja la plataforma en blanco. La causa no esta en el
   codigo: el arranque solo crea tablas que falten y nunca borra. Lo que pasa
   es que `/app/data` es el disco temporal del contenedor, que se rehace en
   cada despliegue.
   **Arreglo (solo se puede desde el panel):** Settings → Volumes → New Volume,
   *Mount path* = `/app/data`. Si Railway obliga a otra ruta, montarlo donde
   sea y definir la variable `CRM_DATA_DIR` con esa misma ruta.
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
Tailwind CSS v4 · shadcn/ui · SQLite + Drizzle ORM · @dnd-kit

**Alias**: `@/*` → `./src/*`

### Directorios

- `src/app/` — paginas y API routes
- `src/components/pipeline/` — tablero, tarjetas y dialogos del pipeline
- `src/components/contacts/` — tabla, ficha y formulario de contactos
- `src/components/dashboard/` — KPIs, embudo, graficas
- `src/components/users/` — dialogo de crear/editar colaborador
- `src/components/audit/` — grafica de desempeno, filtros y tabla de registros
- `src/db/` — `schema.ts`, `index.ts` (cliente), `stages.ts` (etapas),
  `users.ts` (siembra del super administrador)
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
| `/api/export` | GET | `?type=contacts` (solo campos del formulario), `visit-states`, `visit-results`. |
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
- **Usuarios, permisos y registros** — se reemplazo la clave compartida por
  usuario y clave por persona, con roles y permisos que el super administrador
  activa uno por uno. Cada movimiento queda etiquetado con quien lo hizo, y la
  pantalla *Registros* muestra la lista y una grafica de desempeno del equipo.
- **Fuente desde el prospecto, y arreglo del embudo** — la fuente se pregunta
  al crear el lead (antes salia todo como "Otro"); "Iniciaron tramite" dejo de
  contar a los clientes perdidos; y cada tarjeta trae un desplegable
  *"Mover a otra etapa..."* para no depender del arrastre.

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
  que Railway no tenia disco persistente en `/app/data`. Diagnostico util: si
  se pierden datos al actualizar, **mirar primero el volumen del hosting**, no
  la siembra ni las migraciones.
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

---

## Persistencia y respaldos

**Toda la informacion del CRM esta en un solo archivo: `crm.db`.** Clientes,
visitas, gestiones, usuarios y el historial. No hay nada mas que guardar:
`crm-config.json` se regenera desde `public/` en cada arranque.

### Donde vive

`src/db/paths.ts` decide la ruta: `./data` por defecto, o lo que diga
**`CRM_DATA_DIR`**. Esa variable existe porque el disco persistente de un
hosting se monta donde diga el panel; si no coincide con `/app/data`, el CRM
escribiria en el disco temporal del contenedor y **cada despliegue empezaria en
blanco**. Con la variable basta apuntarlo al disco de verdad.

`scripts/init.ts` deja en el log del hosting la ruta, si la base ya existia y
cuantas filas hay en cada tabla. Si en produccion la base no existia al
arrancar, imprime un aviso grande. Asi una perdida de datos se ve el mismo dia
y no semanas despues.

### Respaldos

*Configuracion → Respaldos*, solo para el super administrador:

- **Descargar** — usa `.backup()` de better-sqlite3, no una copia del archivo a
  mano: en modo WAL lo ultimo que se guardo vive en `crm.db-wal`, asi que
  copiar solo `crm.db` dejaria fuera los cambios recientes.
- **Restaurar** — **no reemplaza el archivo en disco**: el servidor lo tiene
  abierto y cambiarlo por debajo lo corrompe. En vez de eso engancha el
  respaldo con `ATTACH` y copia las filas tabla por tabla dentro de una
  transaccion (o entra todo o no entra nada). Solo copia las columnas que
  existen en ambos lados, para que un respaldo viejo siga sirviendo aunque
  despues se hayan agregado campos. Antes de tocar nada guarda una copia de lo
  que hay en `data/crm-antes-de-restaurar-<fecha>.db`.

Las claves foraneas se apagan **fuera** de la transaccion: dentro, el PRAGMA no
tiene efecto y el borrado fallaria por el orden de las tablas.

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
