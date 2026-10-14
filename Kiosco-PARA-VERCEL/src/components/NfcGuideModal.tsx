import React, { useState } from 'react';
import { Smartphone, QrCode, Copy, Check, Radio, ExternalLink, X, HelpCircle, Sparkles } from 'lucide-react';

interface NfcGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const NfcGuideModal: React.FC<NfcGuideModalProps> = ({ isOpen, onClose, appUrl }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'nfc' | 'qr'>('nfc');

  if (!isOpen) return null;

  const nfcUrl = `${appUrl || window.location.origin}/?mode=nfc`;
  // Generate QR code using quickchart / qr server
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(nfcUrl)}&margin=10`;

  const handleCopy = () => {
    navigator.clipboard.writeText(nfcUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Cartel Kiosco NFC / QR</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; margin: 0; }
            .card { border: 3px solid #10b981; border-radius: 20px; padding: 30px; max-width: 480px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            h1 { color: #065f46; margin-bottom: 8px; font-size: 26px; }
            p { color: #374151; font-size: 16px; margin-top: 4px; }
            .qr { margin: 24px auto; width: 240px; height: 240px; display: block; border-radius: 12px; }
            .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: bold; padding: 6px 14px; border-radius: 999px; margin-bottom: 12px; }
            .steps { text-align: left; background: #f9fafb; padding: 16px 20px; border-radius: 12px; margin-top: 20px; font-size: 14px; color: #4b5563; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">📲 AUTOSERVICIO RÁPIDO</span>
            <h1>¡Acerca tu celular o escanea!</h1>
            <p>Anota lo que te estás llevando y se sumará a tu cuenta quincenal.</p>
            <img class="qr" src="${qrUrl}" alt="QR Kiosco" />
            <div class="steps">
              <strong>Cómo funciona:</strong>
              <ol style="margin: 8px 0 0; padding-left: 20px;">
                <li>Acerca tu celular al sticker NFC o escanea el QR.</li>
                <li>Escribe tu nombre y el producto.</li>
                <li>¡Listo! Paga todo junto en la quincena.</li>
              </ol>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Configuración de NFC y QR</h3>
              <p className="text-xs text-emerald-100">Enlaza tu sticker NFC o imprime el cartel</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 p-1.5 gap-2">
          <button
            onClick={() => setActiveTab('nfc')}
            className={`flex-1 py-2 px-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'nfc'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            Grabar Sticker NFC
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 px-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'qr'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            Cartel con Código QR
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Target URL Box */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
              URL Directa para el NFC:
            </label>
            <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
              <input
                type="text"
                readOnly
                value={nfcUrl}
                className="bg-transparent text-xs text-gray-800 font-mono flex-1 outline-hidden select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Al tocar el NFC, el teléfono abrirá directamente la pantalla de registro sin contraseñas.
            </p>
          </div>

          {activeTab === 'nfc' ? (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
                <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  ¿Cómo programar tu sticker NFC en 3 pasos?
                </h4>
                <ol className="text-xs text-emerald-800 space-y-2 list-decimal list-inside">
                  <li>
                    Descarga en tu celular la app gratuita <strong>NFC Tools</strong> (disponible para Android y iPhone).
                  </li>
                  <li>
                    Abre la app, toca en <strong>"Escribir" (Write)</strong> → <strong>"Añadir un registro"</strong> → <strong>"URL / Enlace"</strong>.
                  </li>
                  <li>
                    Pega la URL copiada arriba, pulsa <strong>"Escribir"</strong> y acerca tu sticker NFC al reverso de tu celular. ¡Listo!
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-800">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>¿Qué stickers NFC comprar?</strong>
                  <p className="mt-0.5 text-blue-700">
                    Cualquier sticker o tarjeta <strong>NTAG213, NTAG215 o NTAG216</strong> (son muy económicos en Amazon, Mercado Libre o AliExpress). Pégalo en el frigobar, la alacena o la mesa de snacks.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-md">
                <img src={qrUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg" />
                <span className="inline-block mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Escanea para registrar consumo
                </span>
              </div>

              <p className="text-xs text-gray-600 max-w-sm mx-auto">
                Para compañeros que no tengan NFC activo en su teléfono, puedes imprimir este cartel y pegarlo junto a los snacks.
              </p>

              <button
                onClick={handlePrint}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <ExternalLink className="w-4 h-4" />
                Imprimir Cartel Listo para Pegar
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
