/**
 * Migra los datos locales (data/store.json) a Firestore (Firebase).
 *
 * Uso:
 *   npm run migrate:firestore                          (busca ./serviceAccount.json)
 *   npm run migrate:firestore -- /ruta/credencial.json
 *   npm run migrate:firestore -- --file ./data/store.json
 *   FIREBASE_SERVICE_ACCOUNT='{...}' npm run migrate:firestore
 *   npm run migrate:firestore -- --dry-run             (no sube nada, solo muestra)
 *
 * NOTA: sobrescribe el documento `kiosco/store` en Firestore. Si ya tienes datos
 * en la nube, hazlo con cuidado.
 */
import fs from 'fs';
import path from 'path';

// ---- Parseo simple de argumentos ----
const argv = process.argv.slice(2);
const opts: { dryRun?: boolean; file?: string } = {};
const positionals: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--file') opts.file = argv[++i];
  else if (a.startsWith('--')) { /* bandera desconocida: ignorar */ }
  else positionals.push(a);
}

const STORE_PATH = path.resolve(
  opts.file || process.env.STORE_FILE || path.join(process.cwd(), 'data', 'store.json')
);

if (!fs.existsSync(STORE_PATH)) {
  console.error(`\n❌ No encontré el archivo de datos locales: ${STORE_PATH}`);
  console.error('   Verifica que exista data/store.json en el proyecto.');
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
const orders = Array.isArray(store.orders) ? store.orders.length : 0;
const payments = Array.isArray(store.payments) ? store.payments.length : 0;
const products = Array.isArray(store.products) ? store.products.length : 0;
const imports = Array.isArray(store.imports) ? store.imports.length : 0;

console.log('\n📦 Datos locales encontrados:');
console.log(`   Archivo:   ${STORE_PATH}`);
console.log(`   Pedidos:   ${orders}`);
console.log(`   Abonos:    ${payments}`);
console.log(`   Productos: ${products}`);
console.log(`   Importac.: ${imports}`);

if (opts.dryRun) {
  console.log('\n(--dry-run) No se subió nada. Quita --dry-run para migrar de verdad.\n');
  process.exit(0);
}

function loadServiceAccount(): any | null {
  // 1) Variable de entorno (JSON directo o base64)
  const env = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (env && env.trim()) {
    const t = env.trim();
    return JSON.parse(t.startsWith('{') ? t : Buffer.from(t, 'base64').toString('utf8'));
  }
  // 2) Ruta pasada como argumento, GOOGLE_APPLICATION_CREDENTIALS o nombres por defecto
  const candidates = [
    positionals[0],
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'serviceAccount.json',
    'service-account.json'
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, 'utf-8'));
  }
  return null;
}

async function main() {
  const sa = loadServiceAccount();
  if (!sa) {
    console.error('\n❌ No encontré credenciales de Firebase.');
    console.error('   Opción A: npm run migrate:firestore -- /ruta/al/credencial.json');
    console.error('   Opción B: pon el archivo como ./serviceAccount.json');
    console.error('   Opción C: define la variable FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
  }

  console.log(`\n🔑 Proyecto de Firebase: ${sa.project_id || sa.projectId || '(desconocido)'}`);

  const adminMod: any = await import('firebase-admin');
  const firestoreMod: any = await import('firebase-admin/firestore');

  if (!adminMod.getApps().length) {
    adminMod.initializeApp({ credential: adminMod.cert(sa) });
  }
  const db = firestoreMod.getFirestore();

  const collection = process.env.FIRESTORE_COLLECTION || 'kiosco';
  const docId = process.env.FIRESTORE_DOC_ID || 'store';

  console.log(`⬆️  Subiendo a Firestore: ${collection}/${docId} ...`);
  await db.collection(collection).doc(docId).set(store);

  console.log('\n✅ ¡Listo! Tus datos ya están en Firestore.');
  console.log('   Entra a Firebase Console → Firestore Database para verlos.\n');
}

main().catch((err) => {
  console.error('\n❌ Error al migrar:', err?.message || err, '\n');
  process.exit(1);
});
