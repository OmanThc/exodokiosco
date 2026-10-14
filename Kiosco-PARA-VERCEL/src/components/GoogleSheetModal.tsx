import React, { useState } from 'react';
import { FileSpreadsheet, Copy, Check, ExternalLink, X, AlertCircle, CheckCircle2, Play, RefreshCw } from 'lucide-react';
import { testGoogleSheetsConnection } from '../services/api';

interface GoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScriptUrl: string;
  onSaveScriptUrl: (url: string) => void;
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({
  isOpen,
  onClose,
  currentScriptUrl,
  onSaveScriptUrl
}) => {
  const [scriptUrl, setScriptUrl] = useState(currentScriptUrl);
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const scriptCode = `// Pega este código en Google Sheets: Extensiones > Apps Script
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // Si la hoja está nueva, crear encabezados profesionales
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Fecha y Hora", "Nombre Comprador", "Teléfono", "Producto(s)", "Cantidad", "Monto Total", "Estado"]);
      sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#e6f4ea").setFontColor("#137333");
    }
    
    var timeZone = Session.getScriptTimeZone() || "GMT-5";
    var fechaStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    
    var nombre = data.nombre || "Anónimo";
    var telefono = data.telefono || "";
    var producto = data.producto || "";
    var cantidad = Number(data.cantidad) || 1;
    var monto = Number(data.monto) || 0;
    var estado = data.estado || "Pendiente";
    
    sheet.appendRow([fechaStr, nombre, telefono, producto, cantidad, monto, estado]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Registro guardado exitosamente en tu Google Sheet",
      row: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTest = async () => {
    if (!scriptUrl) {
      setTestResult({ success: false, message: 'Primero ingresa la URL de tu Web App de Google Apps Script.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGoogleSheetsConnection(scriptUrl);
      setTestResult({
        success: res.success,
        message: res.message
      });
      if (res.success) {
        onSaveScriptUrl(scriptUrl);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error al conectar' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveScriptUrl(scriptUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-emerald-100 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Conectar tu Excel / Google Sheet</h3>
              <p className="text-xs text-emerald-100">Sincronización automática de cada compra en tiempo real</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Note */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>¿Ya tienes tu hoja de cálculo creada?</strong>
              <p className="mt-0.5 text-emerald-800">
                Solo necesitas 2 minutos para conectar tu archivo. Cada vez que alguien escanee el NFC y anote un producto, se agregará una nueva fila a tu hoja automáticamente.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Instrucciones paso a paso:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs text-gray-700">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-black text-emerald-700 mr-1.5">1.</span>
                Abre tu Google Sheet, ve a <strong>Extensiones → Apps Script</strong>.
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-black text-emerald-700 mr-1.5">2.</span>
                Borra el código que haya, pega el script de abajo y guarda.
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-black text-emerald-700 mr-1.5">3.</span>
                Pulsa <strong>Implementar → Nueva implementación → Aplicación web</strong>.
                <div className="mt-1 text-[11px] text-amber-700 font-semibold">
                  ⚠️ En "¿Quién tiene acceso?", elige "Cualquier usuario" (Anyone).
                </div>
              </div>
            </div>
          </div>

          {/* Script code box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Código para Google Apps Script:
              </label>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-semibold flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Código Copiado!' : 'Copiar Código'}
              </button>
            </div>
            <pre className="p-3 bg-gray-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 border border-gray-800">
              {scriptCode}
            </pre>
          </div>

          {/* URL Input & Test */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Pega aquí la URL de la Aplicación Web generada:
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden font-mono"
              />
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {isTesting ? 'Probando...' : 'Probar Conexión'}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              * Nota: Aunque no conectes Google Sheets, todas las compras se guardan siempre y puedes descargar el archivo Excel (.xlsx) con un clic.
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Guardar URL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
