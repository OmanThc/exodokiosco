#!/bin/bash
# Lanzador: convierte la credencial de Firebase (.json) a base64
# y la copia al portapapeles, para pegarla en Vercel.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.kiosco-node/bin:$PATH"

clear
echo "======================================================"
echo "   Convertir credencial de Firebase a base64"
echo "======================================================"
echo ""
echo "Sirve para pegar FIREBASE_SERVICE_ACCOUNT en Vercel como una sola linea."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "No encontre node. Revisa que el proyecto este completo."
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

read -p "Ruta del archivo .json: " SA

if [ ! -f "$SA" ]; then
  echo ""
  echo "No se encontro el archivo: $SA"
  echo ""
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

B64=$(node scripts/service-account-to-base64.mjs "$SA" | sed -n '/BASE64/,/====/p' | grep -v 'BASE64' | grep -v '====' | tr -d '\n')

echo ""
echo "El base64 ya se copio al portapapeles."
echo ""
printf '%s' "$B64" | pbcopy 2>/dev/null

echo "Pegalo en Vercel como valor de FIREBASE_SERVICE_ACCOUNT."
echo ""
read -p "Presiona Enter para cerrar..."
