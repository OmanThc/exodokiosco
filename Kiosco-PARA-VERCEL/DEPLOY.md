# Cómo publicar el Kiosco Éxodo en internet

Esta app **no es solo una web**: tiene un **servidor Node/Express** (`server.ts`) que guarda los
pedidos, abonos y la cobranza. Puedes publicarla de dos maneras:

| Camino | Dónde corre la API | Dónde viven los datos | Ideal si… |
|---|---|---|---|
| **Vercel + Firebase** (recomendado) | Funciones serverless de Vercel | **Firestore** (Firebase) | Quieres usar Vercel y Firebase |
| **Host Node con disco** (Fly/Railway/VPS) | Servidor Node normal | `store.json` en un volumen | Quieres lo más simple, sin base de datos |

> ⚠️ No uses hosting **estático puro** (GitHub Pages, Netlify estático): la app necesita ejecutar la API.

---

## Cómo funciona la app

| Parte | Qué es |
|---|---|
| Frontend | React + Vite (se compila a la carpeta `dist/`) |
| Backend | `server.ts` (Express). Sirve `dist/` y la API `/api/*` |
| Base de datos | **Local**: `store.json` (variable `DATA_DIR`). **Nube**: Firestore (`DATA_BACKEND=firestore`) |
| Respaldos | En local: `DATA_DIR/backups/` + `store.json.bak`. En Firestore: documentos `backup-...` |
| Google Sheets | Se conecta por un Web App de Google Apps Script (se configura en la app) |

Variables de entorno:
- `PORT` → puerto del servidor (por defecto 3000)
- `DATA_DIR` → carpeta de datos cuando el backend es local
- `DATA_BACKEND` → `firestore` para usar Firebase (si no, usa archivo local)
- `FIREBASE_SERVICE_ACCOUNT` → credenciales de Firebase (ver abajo)

---

## ❓ «¿Cuál es el archivo que debo subir a Vercel?»

**Ninguno en concreto: Vercel no recibe "un archivo", recibe TODO el proyecto (la carpeta entera).**

Vercel funciona distinto a un hosting normal:

1. Tú pones la **carpeta del proyecto** en **GitHub** (o la subes con la **CLI de Vercel**).
2. Vercel **lee esa carpeta**, instala dependencias, compila la web (`npm run build`) y publica la
   API (`api/index.ts`) como **función en la nube**.
3. `node_modules`, `dist` y `data` **no se suben**: Vercel los genera solo.

Archivos que hacen que Vercel sepa qué hacer (ya vienen incluidos y configurados):
`vercel.json`, `api/index.ts`, `package.json`, `src/`, `public/`, `index.html`.
👉 Por eso: **se sube el proyecto completo, no un solo archivo.**

### Forma A — GitHub + Vercel (recomendada)
1. Descomprime el zip del proyecto.
2. Crea un repositorio en **https://github.com** y sube los archivos del proyecto.
3. En **https://vercel.com** → **Add New → Project** → importa ese repositorio → **Deploy**.

### Forma B — CLI de Vercel (sin GitHub)
En la carpeta del proyecto:
```bash
npm i -g vercel     # o usa: npx vercel
vercel              # responde las preguntas (la 1ª vez pide iniciar sesión)
```
La CLI sube la carpeta desde tu Mac y te da la URL `https://<tu-app>.vercel.app`.

> 💡 **Verás la misma información en cualquier equipo** (PC, tablet, celular) porque los datos no
> viven en tu Mac: viven en **Firestore** (Firebase) y todos los dispositivos leen de la misma URL.

---

# ⭐ Opción 1 — Vercel + Firebase (Firestore)

Vercel **no tiene disco permanente** (cada petición arranca de cero), así que los datos se guardan en
**Firestore**. El código ya viene preparado para esto (no hay que programar nada, solo configurar).

## Paso 1 — Crear el proyecto en Firebase Console

1. Entra a **https://console.firebase.google.com** y crea un proyecto (ej. `kiosco-exodo`).
2. Menú izquierdo → **Compilación → Firestore Database → Crear base de datos**.
   - Elige **modo de producción** y una ubicación (ej. `nam5 (us-central)`).
3. Menú ⚙️ (arriba) → **Configuración del proyecto → pestaña "Cuentas de servicio"**.
4. Clic en **"Generar nueva clave privada"** → se descarga un archivo `.json`.
   - **Guárdalo bien y NO lo subas a internet ni a GitHub.**

> Las reglas de seguridad de Firestore pueden quedarse cerradas: la app escribe con la cuenta de
> servicio (Admin SDK), que las ignora. Ningún dispositivo entra directo a Firestore.

## Paso 2 — Subir el proyecto a Vercel

**Antes:** sube la carpeta del proyecto a un repositorio de GitHub (o usa la CLI `vercel`).
El archivo `.gitignore` ya evita subir `node_modules`, `dist` y `data`.

1. Entra a **https://vercel.com** → **Add New → Project** → importa el repositorio.
2. Vercel detecta **Vite**. Confirma:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   (ya está en `vercel.json`, normalmente no hay que tocar nada)
3. En **Environment Variables**, agrega:

   | Nombre | Valor |
   |---|---|
   | `DATA_BACKEND` | `firestore` |
   | `FIREBASE_SERVICE_ACCOUNT` | el **contenido completo** del `.json` descargado |

   > Si tu panel no acepta el JSON multilínea, conviértelo a base64 y pégalo igual:
   > ```bash
   > base64 -i serviceAccount.json | tr -d '\n'
   > ```
   > (La app acepta el JSON tal cual **o** en base64.)

4. **Deploy**. Vercel te da una URL tipo `https://kiosco-exodo.vercel.app`.

## Paso 3 — Verificar

- Abre `https://TU-APP.vercel.app/api/data` → debe responder JSON con `"success":true`.
- En Firestore Console verás la colección **`kiosco`** con el documento **`store`**.
- Entra a la app, registra un pedido y recarga: debe seguir ahí.

## Alternativa (todo Google): Firebase Hosting + Functions

Si prefieres que TODO viva en Firebase, se puede usar **Firebase Hosting** (frontend) + **Cloud
Functions** (la API) + **Firestore**. Requiere el plan Blaze y algo más de configuración. Dímelo y
te lo preparo. Lo que ya tienes montado (Vercel + Firestore) es más rápido de arrancar.

---

# Opción 2 — Host Node con disco persistente (sin base de datos)

Sirve para Fly.io, Railway, Render o un VPS. Aquí **no** se toca el backend: los datos siguen en
`store.json` dentro de un volumen. La imagen usa **Docker** (archivo `Dockerfile` incluido).

## Fly.io

1. Instala la CLI:
   ```bash
   brew install flyctl        # o: curl -L https://fly.io/install.sh | sh
   fly auth signup            # crea cuenta (pide tarjeta)
   ```
2. En la carpeta del proyecto:
   ```bash
   fly launch --no-deploy     # acepta el Dockerfile; NO agregues Postgres/Redis
   ```
   - Si el nombre `kiosco-exodo` ya existe, elige otro y actualízalo en `fly.toml`.
3. Crea el disco persistente:
   ```bash
   fly volumes create kiosco_data --size 1 --region mia
   ```
4. Publica y abre:
   ```bash
   fly deploy
   fly open                   # https://<tu-app>.fly.dev
   ```

## Railway (más visual)

1. Cuenta en https://railway.app → **New Project → Deploy from GitHub** (o CLI `railway up`).
2. Agrega un **Volume** montado en `/data`.
3. Variable de entorno: `DATA_DIR=/data` (Railway define `PORT` solo).
4. Te da una URL `https://<algo>.up.railway.app`.

## VPS propio (DigitalOcean, Hetzner, Hostinger…)

```bash
docker build -t kiosco .
docker run -d --name kiosco -p 80:3000 \
  -e PORT=3000 -e DATA_DIR=/data \
  -v kiosco_data:/data \
  --restart unless-stopped \
  kiosco
```
(Recomendado: HTTPS con Caddy o nginx como proxy inverso.)

## Túnel desde tu Mac (probar ya, sin servidor en la nube)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```
Te da una URL temporal `https://algo.trycloudflare.com`. Gratis, pero **cambia** cada vez y solo
funciona mientras tu Mac esté encendida.

---

## Pasar tus datos locales a Firestore (migración)

Ya viene incluido un script de migración.

**Opción fácil (doble clic):** ejecuta **`Migrar datos a Firebase.command`** y escribe la ruta del
`.json` de la cuenta de servicio. Sube `data/store.json` al documento `kiosco/store`.

**Opción terminal:**
```bash
npm run migrate:firestore -- /ruta/al/credencial.json
```
- Ver primero **sin subir nada**: `npm run migrate:firestore -- --dry-run`
- ⚠️ **Sobrescribe** lo que ya exista en el documento `kiosco/store` de Firestore.

### Convertir la credencial a base64 (para Vercel)

Si Vercel no acepta el JSON multilínea, usa el lanzador
**`Convertir credencial a base64.command`** (copia el resultado al portapapeles), o:
```bash
npm run base64:sa -- /ruta/al/credencial.json
```
Pega esa línea como valor de `FIREBASE_SERVICE_ACCOUNT`.

### De Firestore → local

Copia el documento `kiosco/store` (Firebase Console) a un `store.json` dentro de `data/`.


## Notas importantes

- **No subas** el `.json` de la cuenta de servicio ni el `.env` a GitHub.
- Firestore guarda todo el kiosco en **un solo documento** `kiosco/store`. Tiene un límite de **1 MB**
  (≈ miles de pedidos). Si algún día crece mucho, se puede repartir en colecciones.
- Los respaldos automáticos funcionan en ambos modos: en local a `data/backups/`, en Firestore a
  documentos `kiosco/backup-antes-de-borrar-...`.
- La app ya trae el botón **"Borrar todo el historial"** (con respaldo) en Historial de Ventas,
  Cierre Quincenal y Configuración.
- El PIN de administrador y los productos viajan con los datos (están en `store.json` / Firestore).
