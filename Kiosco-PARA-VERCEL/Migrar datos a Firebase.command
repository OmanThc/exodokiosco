#!/bin/bash
# Lanzador: migra los datos locales (data/store.json) a Firestore (Firebase).
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.kiosco-node/bin:$PATH"

clear
echo "======================================================"
echo "   Migrar datos del Kiosco a Firebase (Firestore)"
echo "======================================================"
echo ""
echo "Necesitas el archivo .json de la cuenta de servicio:"
echo "  Firebase Console -> Configuracion del proyecto"
echo "  -> Cuentas de servicio -> Generar nueva clave privada"
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "No encontre npm/node. Revisa que el proyecto este completo."
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

read -p "Ruta del archivo .json (Enter = ./serviceAccount.json): " SA
SA="${SA:-./serviceAccount.json}"

if [ ! -f "$SA" ]; then
  echo ""
  echo "No se encontro el archivo: $SA"
  echo "Copia el .json a esta carpeta y vuelve a intentar."
  echo ""
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

echo ""
npm run migrate:firestore -- "$SA"

echo ""
read -p "Presiona Enter para cerrar..."
