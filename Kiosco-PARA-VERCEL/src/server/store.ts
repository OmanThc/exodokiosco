import fs from 'fs';
import path from 'path';
import type { AppSettings, CatalogProduct } from '../types';

/**
 * Capa de datos con DOS backends seleccionables:
 *
 *  - LOCAL (por defecto): guarda en un archivo JSON (data/store.json).
 *    Es lo que usa tu Mac hoy. No necesita nada extra.
 *
 *  - FIRESTORE (Firebase): guarda en la nube. Se activa con la variable de
 *    entorno DATA_BACKEND=firestore o con credenciales de Firebase.
 *    Es lo que hace falta para Vercel (serverless, sin disco).
 *
 * El resto del servidor no necesita saber cuál está activo: solo llama a
 * readStore()/writeStore().
 */

export interface ImportBatch {
  id: string;
  fecha: string;
  fileName?: string;
  replaceMode: boolean;
  ordersAdded: number;
  paymentsAdded: number;
  addedOrderIds: string[];
  addedPaymentIds: string[];
  // Solo se usa en modo "Reemplazar Todo" para poder restaurar lo que había antes
  snapshotOrders?: any[];
  snapshotPayments?: any[];
}

export interface StoreData {
  orders: any[];
  products: any[];
  payments: any[];
  settings: AppSettings;
  imports: ImportBatch[];
}

// Initial default catalog and settings
export const DEFAULT_PRODUCTS: CatalogProduct[] = [
  { id: 'prod-fruton', nombre: 'FRUTON', precio: 0.70, categoria: 'Bebidas', emoji: '🧃', imagenUrl: '', stockNevera: 12, stockDeposito: 24, stock: 36 },
  { id: 'prod-malta', nombre: 'MALTA', precio: 1.00, categoria: 'Bebidas', emoji: '🥤', imagenUrl: '', stockNevera: 15, stockDeposito: 30, stock: 45 },
  { id: 'prod-glu-bombita', nombre: 'GLU BOMBITA', precio: 0.50, categoria: 'Dulces', emoji: '🍬', promo: '2 por 1$', imagenUrl: '', stockNevera: 20, stockDeposito: 50, stock: 70 },
  { id: 'prod-cool-power', nombre: 'COOL POWER', precio: 0.80, categoria: 'Bebidas', emoji: '⚡', imagenUrl: '', stockNevera: 10, stockDeposito: 20, stock: 30 },
  { id: 'prod-tea-durazno', nombre: 'TEA DURAZNO', precio: 0.80, categoria: 'Bebidas', emoji: '🍑', imagenUrl: '', stockNevera: 10, stockDeposito: 20, stock: 30 }
];

export const DEFAULT_SETTINGS: AppSettings = {
  scriptUrl: '',
  currency: '$',
  businessName: 'Kiosco & Frigobar de Confianza',
  businessSubtitle: 'Acerca tu celular al NFC, anota lo que te llevas y paga en la quincena',
  paymentInfo: 'Transferencia / Pago Móvil: 04140153904\nTitular: Andrés Omaña',
  adminPin: '4520091',
  logoUrl: '',
  themeColor: 'emerald',
  customColors: {
    appBackground: '#f1f5f9',
    sectionCardBg: '#ffffff',
    headerBg: '#065f46',
    headerText: '#ffffff',
    cardBackground: '#ffffff',
    cardBorder: '#e2e8f0',
    titleText: '#0f172a',
    priceAccent: '#059669',
    primaryButtonBg: '#059669',
    primaryButtonText: '#ffffff',
    secondaryButtonBg: '#1e293b',
    secondaryButtonText: '#ffffff',
    stepperButtonBg: '#059669',
    stepperButtonText: '#ffffff',
    categoryActiveBg: '#059669',
    categoryActiveText: '#ffffff',
    adminButtonBg: '#0f172a',
    adminButtonText: '#34d399'
  }
};

// =====================================================================
// Selección de backend
// =====================================================================

const DATA_BACKEND = (process.env.DATA_BACKEND || '').toLowerCase();

/**
 * Firestore se activa si:
 *  - DATA_BACKEND=firestore  (explícito), o
 *  - hay credenciales de Firebase en el entorno (FIREBASE_SERVICE_ACCOUNT / FIREBASE_PROJECT_ID)
 */
export const USING_FIRESTORE: boolean =
  DATA_BACKEND === 'firestore' ||
  !!process.env.FIREBASE_SERVICE_ACCOUNT ||
  !!process.env.FIREBASE_PROJECT_ID;

const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || 'kiosco';
const FIRESTORE_DOC_ID = process.env.FIRESTORE_DOC_ID || 'store';

// Ruta del archivo local (solo se usa en modo local)
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// =====================================================================
// Normalización (igual que antes: rellena productos y configuración)
// =====================================================================

function normalize(parsed: any): StoreData {
  const rawProducts = Array.isArray(parsed?.products) && parsed.products.length > 0
    ? parsed.products
    : DEFAULT_PRODUCTS;

  const normalizedProducts = rawProducts.map((p: any) => ({
    ...p,
    stockNevera: typeof p.stockNevera === 'number' ? p.stockNevera : 10,
    stockDeposito: typeof p.stockDeposito === 'number' ? p.stockDeposito : 20,
    stock: (typeof p.stockNevera === 'number' ? p.stockNevera : 10) + (typeof p.stockDeposito === 'number' ? p.stockDeposito : 20),
    imagenUrl: p.imagenUrl || ''
  }));

  return {
    orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
    products: normalizedProducts,
    payments: Array.isArray(parsed?.payments) ? parsed.payments : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed?.settings || {}) },
    imports: Array.isArray(parsed?.imports) ? parsed.imports : []
  };
}

// =====================================================================
// Backend LOCAL (archivo JSON)
// =====================================================================

function ensureLocalDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // En algunos hosts el disco es de solo lectura; se ignora.
  }
}

function readLocal(): StoreData {
  try {
    ensureLocalDir();
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      return normalize(JSON.parse(content));
    }
  } catch (err) {
    console.error('Error reading store file, using defaults:', err);
  }
  return normalize({});
}

function writeLocal(data: StoreData) {
  try {
    ensureLocalDir();
    // Respaldo automático del estado anterior (por seguridad / para recuperar)
    if (fs.existsSync(STORE_FILE)) {
      try {
        fs.copyFileSync(STORE_FILE, STORE_FILE + '.bak');
      } catch { /* ignorar errores de respaldo */ }
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store file:', err);
  }
}

// =====================================================================
// Backend FIRESTORE (Firebase)
// =====================================================================

let _dbPromise: Promise<any> | null = null;

/**
 * Inicializa Firebase (una sola vez) y devuelve la instancia de Firestore.
 * Usa la API modular de firebase-admin v13/v14.
 */
async function getFirestoreDb(): Promise<any> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      // imports dinámicos: en modo local no se carga firebase-admin
      const adminMod: any = await import('firebase-admin');
      const firestoreMod: any = await import('firebase-admin/firestore');

      const initializeApp = adminMod.initializeApp;
      const getApps = adminMod.getApps;
      const cert = adminMod.cert;
      const getFirestore = firestoreMod.getFirestore;

      if (!getApps().length) {
        const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

        if (saRaw && saRaw.trim().length > 0) {
          // Puede venir como JSON directo o en base64
          const jsonText = saRaw.trim().startsWith('{')
            ? saRaw
            : Buffer.from(saRaw, 'base64').toString('utf8');
          const serviceAccount = JSON.parse(jsonText);
          initializeApp({ credential: cert(serviceAccount) });
        } else if (
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY
        ) {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
          });
        } else {
          // Application Default Credentials (Cloud Run / Cloud Functions / gcloud local)
          initializeApp();
        }
      }

      return getFirestore();
    })();
    // Si la inicializacion falla (p. ej. credenciales temporales), permitir
    // reintentar en la siguiente peticion en lugar de fallar para siempre.
    _dbPromise.catch(() => { _dbPromise = null; });
  }
  return _dbPromise;
}

async function readFirestore(): Promise<StoreData> {
  const db = await getFirestoreDb();
  const snap = await db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID).get();
  const data = snap.exists ? snap.data() : {};
  return normalize(data);
}

async function writeFirestore(data: StoreData): Promise<void> {
  const db = await getFirestoreDb();
  await db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID).set(data);
}

// =====================================================================
// API pública (la usa el servidor)
// =====================================================================

export async function readStore(): Promise<StoreData> {
  if (USING_FIRESTORE) return readFirestore();
  return readLocal();
}

export async function writeStore(data: StoreData): Promise<void> {
  if (USING_FIRESTORE) {
    await writeFirestore(data);
    return;
  }
  writeLocal(data);
}

/**
 * Respaldo manual antes de una acción destructiva (borrar todo el historial).
 * En local guarda un archivo con marca de tiempo; en Firestore guarda un documento aparte.
 */
export async function backupStore(store: StoreData): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (USING_FIRESTORE) {
    try {
      const db = await getFirestoreDb();
      await db
        .collection(FIRESTORE_COLLECTION)
        .doc(`backup-antes-de-borrar-${stamp}`)
        .set(store);
    } catch (err) {
      console.error('No se pudo crear el respaldo en Firestore:', err);
    }
    return;
  }

  try {
    const BACKUP_DIR = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(BACKUP_DIR, `store-antes-de-borrar-${stamp}.json`),
      JSON.stringify(store, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('No se pudo crear el respaldo antes de borrar:', err);
  }
}
