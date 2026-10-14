// Entrada serverless para Vercel.
//
// Vercel ejecuta ESTE archivo como funcion y reutiliza el MISMO servidor
// Express de `src/server/app.ts` (con todas las rutas /api/...).
// Los datos viven en Firestore (Firebase), porque Vercel no tiene disco.
//
// No abre puertos ni sirve estaticos: de eso se encarga Vercel.
import app from '../src/server/app';

export default function handler(req: any, res: any) {
  const url: string = typeof req.url === 'string' ? req.url : '/';

  // Normaliza la ruta para que Express siempre reciba el prefijo /api
  // (funciona tanto si Vercel conserva la ruta original como si la reescribe).
  if (!url.startsWith('/api')) {
    req.url = '/api' + (url.startsWith('/') ? url : '/' + url);
  }

  // Una app de Express es "callable": app(req, res)
  return (app as any)(req, res);
}
