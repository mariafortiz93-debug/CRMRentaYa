# Publicar el CRM para todo el equipo

Objetivo: que Oscar, Kelly, Richard, Katia y la directora comercial entren
desde su computador o celular con un enlace, **cada uno con su propio usuario y
su propia clave**, y que todos vean la misma informacion en tiempo real.

> **Ya esta publicado en <https://crmrentaya-production-b3bf.up.railway.app>.**
> Lo de abajo es la explicacion de como quedo montado y que falta por
> confirmar.

---

## Por que no sirve compartirlo por Drive / OneDrive

- **La base de datos se dana.** SQLite bloquea el archivo mientras escribe.
  Drive y OneDrive no respetan ese bloqueo: copian el archivo completo y, si
  dos personas guardan a la vez, crean copias en conflicto o corrompen la base.
- **No es un documento, es un programa.** Cada persona tendria que instalar
  Node.js y levantar un servidor en su maquina.
- **Verian datos viejos.** La sincronizacion no es inmediata.

---

## Opcion recomendada: Railway

Es la mas sencilla. Se conecta a GitHub y despliega solo. Cuesta alrededor de
5 USD al mes (tiene credito gratis para probar).

### Requisito clave: disco persistente

El CRM guarda todo en `data/crm.db`. Sin un disco persistente, **cada vez que
se actualiza la aplicacion se borra la informacion**: clientes, usuarios, todo.
Por eso el paso 3 no es opcional.

Como saber si lo tienes: entra a *Configuracion* despues de un despliegue. Si
los clientes siguen ahi, el disco esta bien. Tambien queda en los logs de
Railway: al arrancar, el CRM imprime `Datos: contacts=... users=...` y, si la
base venia vacia, un aviso en mayusculas.

Si Railway no te deja usar `/app/data`, montalo donde te deje y agrega una
variable `CRM_DATA_DIR` con esa misma ruta.

### Paso a paso

1. **Crear la cuenta**
   Entra a <https://railway.app> y registrate con tu cuenta de GitHub
   (la misma de `mariafortiz93-debug`).

2. **Crear el proyecto**
   - `New Project` -> `Deploy from GitHub repo`
   - Autoriza a Railway a ver tus repos y elige **`CRMRentaYa`**
   - Railway detecta el `Dockerfile` y empieza a construir solo.

3. **Agregar el disco persistente** (imprescindible)
   - Dentro del servicio: `Settings` -> `Volumes` -> `New Volume`
   - **Mount path:** `/app/data`
   - Guarda. El servicio se reinicia con el disco montado.

4. **Poner el secreto de las sesiones**
   - `Variables` -> `New Variable`
   - Nombre: `CRM_SESSION_SECRET`, valor: cualquier texto largo y aleatorio.
     Con el se firman las cookies; si lo cambias, todo el mundo tiene que
     volver a entrar.
   - Opcional: `CRM_ADMIN_USER` y `CRM_ADMIN_PASSWORD` para elegir tu el
     usuario y la clave del primer administrador. Si no los pones, se crea
     `maria` con la clave `RentaYa2026*`.

5. **Generar el enlace**
   - `Settings` -> `Networking` -> `Generate Domain`

6. **Entrar y armar el equipo**
   - Entra con el usuario administrador y **cambia la clave de inmediato**
     desde *Mis datos*. El CRM muestra un aviso amarillo hasta que lo hagas.
   - Ve a *Usuarios* -> `Nuevo colaborador` y crea uno para cada persona.
   - Marca solo las secciones que necesita: un visitador no tiene por que ver
     el dashboard ni borrar clientes.
   - Envia a cada uno su usuario y su clave inicial. La primera vez que entre
     el CRM le pedira cambiarla.

---

## Alternativa mas economica: Fly.io

Tiene capa gratuita mas amplia, pero se configura por linea de comandos
(`fly launch`, `fly volumes create`). Conviene si el costo mensual importa mas
que la comodidad.

---

## Alternativa sin costo: red local de la oficina

Si los cinco trabajan en la misma oficina y en el mismo WiFi:

1. En el computador que hara de servidor:
   ```bash
   npm run build
   npx next start -H 0.0.0.0
   ```
2. Averigua su IP local (`ipconfig` en Windows), por ejemplo `192.168.1.57`.
3. Los demas entran a `http://192.168.1.57:3000`.

Limitaciones: solo funciona dentro de esa red, ese computador debe permanecer
encendido, y no hay HTTPS. El ingreso con usuario y clave funciona igual.

---

## Sobre la informacion actual

Al publicarlo, el CRM en la nube **arranca vacio**: los contactos que tienes
hoy estan en tu computador. Se pueden pasar de dos maneras:

- Exportar los contactos a Excel desde el CRM local y volverlos a cargar, o
- Subir el archivo `data/crm.db` al disco persistente (pideme ayuda y lo hago).

## Respaldos

Toda la informacion vive en un solo archivo: `data/crm.db`.

Desde el CRM: **Configuracion → Respaldos → Descargar respaldo**. Baja ese
archivo y guardalo fuera del servidor (tu computador, Drive, donde sea).
Conviene hacerlo una vez por semana, y siempre antes de una actualizacion
grande.

Para volver atras, en esa misma pantalla esta *Restaurar un respaldo*: subes el
archivo y el CRM reemplaza todo por lo que traiga. Antes de hacerlo guarda solo
una copia de lo que habia, por si te equivocas de archivo.
