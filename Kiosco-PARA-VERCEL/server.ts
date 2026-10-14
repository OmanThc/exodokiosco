import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './src/server/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

// ============================================================
// Arranque del servidor COMPLETO (solo para uso local / Docker / Fly).
// En Vercel NO se usa este archivo: la app vive en src/server/app.ts
// y se expone como funcion en api/index.ts.
// ============================================================
async function setupApp() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Desarrollo: Express + Vite en el mismo puerto (con recarga en caliente)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Produccion: sirve la web compilada (dist/) + la API
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

setupApp();
