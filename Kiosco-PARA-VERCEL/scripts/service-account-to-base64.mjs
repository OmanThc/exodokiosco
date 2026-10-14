/**
 * Convierte el archivo .json de la cuenta de servicio de Firebase a base64.
 * Útil para pegarlo en una sola línea en Vercel (FIREBASE_SERVICE_ACCOUNT).
 *
 * Uso:
 *   npm run base64:sa -- /ruta/al/credencial.json
 *   node scripts/service-account-to-base64.mjs /ruta/al/credencial.json
 */
import fs from 'fs';

const file = process.argv[2];

if (!file) {
  console.error('\nUso: npm run base64:sa -- /ruta/al/credencial.json\n');
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`\nNo existe el archivo: ${file}\n`);
  process.exit(1);
}

const b64 = fs.readFileSync(file).toString('base64');

console.log('\n================= BASE64 (copia esta linea) =================\n');
console.log(b64);
console.log('\n=============================================================\n');
console.log('Pegala en Vercel como valor de la variable FIREBASE_SERVICE_ACCOUNT.\n');
