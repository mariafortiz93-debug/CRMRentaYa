FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# La base de datos es un servicio de PostgreSQL aparte (DATABASE_URL), no un
# archivo dentro del contenedor. Por eso este contenedor ya no necesita disco
# propio: se puede reemplazar en cada despliegue sin perder nada.
#
# `init` crea las tablas que falten y siembra etapas y super administrador.
# Corre al arrancar, no al construir la imagen: en tiempo de construccion
# todavia no existe la variable con la direccion de la base.
CMD ["sh", "-c", "npx tsx scripts/init.ts && npm start"]
