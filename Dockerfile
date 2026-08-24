FROM node:22-slim

WORKDIR /app

# Dependencias de compilacion para better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# La base de datos vive en /app/data, que en produccion es un disco
# persistente montado por el hosting. Por eso la inicializacion NO se hace
# aqui (se perderia al montar el volumen) sino al arrancar el contenedor.
RUN mkdir -p data

EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Crea las tablas si faltan y luego levanta el servidor.
CMD ["sh", "-c", "npx tsx scripts/init.ts && npm start"]
