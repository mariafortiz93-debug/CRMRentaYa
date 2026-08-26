# Publicar el CRM para todo el equipo

Objetivo: que Oscar, Kelly, Richard, Katia y la directora comercial entren
desde su computador o celular con un enlace, **cada uno con su propio usuario y
su propia clave**, y que todos vean la misma informacion en tiempo real.

> **Ya esta publicado en <https://crmrentaya-production-b3bf.up.railway.app>.**
> Lo de abajo es la explicacion de como quedo montado y que falta por
> confirmar.

---

## Por que no sirve compartirlo por Drive / OneDrive

- **No es un documento, es un programa.** Cada persona tendria que instalar
  Node.js, levantar un servidor y una base de datos en su maquina.
- **Cada quien veria lo suyo.** No habria una sola informacion compartida:
  habria cinco copias distintas, y ninguna al dia.

---

## Opcion recomendada: Railway

Es la mas sencilla. Se conecta a GitHub y despliega solo. Cuesta alrededor de
5 USD al mes el servicio del CRM, mas otro tanto la base de datos.

### Requisito clave: la base de datos va aparte

El CRM guarda todo en **PostgreSQL**, que en Railway es un servicio separado.
Eso es lo que hace que la informacion **sobreviva a las actualizaciones**.

Cuando Railway despliega no actualiza el contenedor del CRM: lo **reemplaza**
por uno nuevo. Antes la base era un archivo dentro de ese contenedor, y se iba
con el. Por eso se perdieron los datos tres veces.

Ahora la base esta fuera. No hay disco que montar ni ruta que escribir bien.

### Paso a paso

1. **Crear la cuenta**
   Entra a <https://railway.app> y registrate con tu cuenta de GitHub
   (la misma de `mariafortiz93-debug`).

2. **Crear el proyecto**
   - `New Project` → `Deploy from GitHub repo`
   - Autoriza a Railway a ver tus repos y elige **`CRMRentaYa`**
   - Railway detecta el `Dockerfile` y empieza a construir solo.

3. **Agregar la base de datos** — *imprescindible*
   - En el proyecto: `New` → `Database` → `PostgreSQL`
   - Railway la crea y la conecta al servicio del CRM, inyectando la variable
     `DATABASE_URL`. **No hay que escribirla a mano.**
   - Si el CRM no la ve: entra al servicio del CRM → `Variables` →
     `Add Reference` → elige la base → `DATABASE_URL`.

   Sin este paso el CRM no arranca, y lo dice claro en los logs.

4. **Poner el secreto de las sesiones**
   - `Variables` → `New Variable`
   - Nombre `CRM_SESSION_SECRET`, valor: cualquier texto largo y aleatorio.
     Con el se firman las cookies; si lo cambias, todo el mundo tiene que
     volver a entrar.
   - Opcional: `CRM_ADMIN_USER` y `CRM_ADMIN_PASSWORD` para elegir tu el
     usuario y la clave del primer administrador. Si no los pones, se crea
     `maria` con la clave `RentaYa2026*`.

5. **Generar el enlace**
   - `Settings` → `Networking` → `Generate Domain`

6. **Comprobar que quedo bien**

   En los logs del despliegue debe salir algo asi:

   ```
   Base de datos: xxxxx.railway.internal:5432/railway
   Base existente: no (arranca vacia)
   Tablas listas.
   Etapas del pipeline (11):
     Prospecto -> Contactado -> Visita al Concesionario -> ...
   Super administrador: maria
   Datos: ... contacts=0 users=1 ...
   ```

   En el **segundo** despliegue debe decir `Base existente: si` y conservar el
   numero de clientes. Si sigue diciendo `no`, la base no esta conectada.

7. **Entrar y armar el equipo**
   - Entra con el usuario administrador y **cambia la clave de inmediato**
     desde *Mis datos*. El CRM muestra un aviso amarillo hasta que lo hagas.
   - Ve a *Usuarios* → `Nuevo colaborador` y crea uno para cada persona.
   - Marca solo las secciones que necesita: un visitador no tiene por que ver
     el dashboard ni borrar clientes.
   - Crea un **segundo super administrador**, por si pierdes tu clave.
   - Envia a cada uno su usuario y su clave inicial. La primera vez que entre,
     el CRM le pedira cambiarla.

---

## Levantarlo en tu computador

Necesitas un PostgreSQL. Lo mas facil es con Docker:

```bash
docker compose up
```

Eso levanta la base y el CRM juntos, en <http://localhost:3000>.

Sin Docker, instala PostgreSQL, crea una base y pon la direccion en
`.env.local`:

```
DATABASE_URL=postgresql://usuario:clave@localhost:5432/crm
CRM_SESSION_SECRET=lo-que-quieras
```

Despues:

```bash
npm install
npm run init
npm run dev
```

---

## Respaldos

**Configuracion → Respaldos → Descargar respaldo.** Baja un archivo JSON con
todo (clientes, visitas, gestiones, usuarios e historial) y guardalo fuera del
servidor: tu computador, Drive, donde sea. Conviene hacerlo una vez por semana,
y siempre antes de una actualizacion grande.

Para volver atras, en esa misma pantalla esta *Restaurar un respaldo*: subes el
archivo y el CRM reemplaza todo por lo que traiga. **Descarga un respaldo antes
de restaurar**, por si subes el archivo equivocado.

Los respaldos viejos en formato `.db` ya no sirven: eran de cuando la base era
SQLite.

### Segunda red: exportar e importar contactos

En *Contactos* estan los botones **Exportar** e **Importar**. El archivo que
descargas se puede volver a subir tal cual: cada cliente vuelve con sus datos y
a su columna del pipeline. Los que ya existen se actualizan, no se duplican.

**No reemplaza al respaldo.** El Excel solo lleva los datos del formulario y la
etapa; las visitas agendadas, el historico de gestiones, los usuarios y los
registros solo vuelven con el respaldo JSON.

---

## Si te quedas por fuera del CRM

Si se pierde la clave del super administrador nadie puede volver a entrar: el
CRM no manda correos y solo el super administrador administra usuarios.

**La forma facil de prevenirlo:** entra a *Usuarios* y crea un segundo
colaborador con rol **Super administrador**. Con dos, uno siempre le puede
restablecer la clave al otro.

**Si ya te quedaste por fuera**, desde el panel del hosting:

1. `Variables` → agrega **`CRM_RECOVERY_USER`** (por ejemplo `respaldo`) y
   **`CRM_RECOVERY_PASSWORD`** con una clave que elijas tu.
2. El servicio se reinicia solo. Ese usuario queda activo como super
   administrador.
3. Entra con el, cambia la clave (el CRM te la pide de una) y arregla lo que
   haga falta en *Usuarios*.
4. **Borra las dos variables.** Mientras esten puestas, esa clave se vuelve a
   imponer en cada despliegue.

No borra ni degrada a nadie mas: solo agrega o repara ese usuario.
