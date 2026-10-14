# Imagen para desplegar el Kiosco Exodo en la nube.
# Sirve para Fly.io, Railway, Render, Google Cloud Run o cualquier VPS con Docker.
FROM node:22-slim

WORKDIR /app

# 1) Instalar dependencias (incluye las de desarrollo: hacen falta para compilar)
#    --legacy-peer-deps es necesario por un conflicto de versiones de esbuild.
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 2) Copiar el proyecto y compilar el frontend (genera /app/dist)
COPY . .
RUN npm run build

# 3) Modo produccion: el servidor Express sirve /app/dist y la API /api/*
ENV NODE_ENV=production
ENV PORT=3000
# Carpeta de datos persistente. En la nube monta un volumen en /data.
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

CMD ["npm", "start"]
