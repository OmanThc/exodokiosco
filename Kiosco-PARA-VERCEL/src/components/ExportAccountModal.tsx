import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, Download, Copy, Check, X, Share2, 
  FileSpreadsheet, Image as ImageIcon, Phone, CheckCircle2, AlertCircle,
  CreditCard, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BuyerSummary, ThemeColorId } from '../types';
import { generateWhatsAppMessage } from '../utils/quincena';
import { formatMoney } from '../utils/format';
import { getTheme } from '../utils/theme';

interface ExportAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyer: BuyerSummary | null;
  periodLabel: string;
  currency: string;
  paymentInfo: string;
  businessName: string;
  logoUrl?: string;
  themeColor?: ThemeColorId;
}

export const ExportAccountModal: React.FC<ExportAccountModalProps> = ({
  isOpen,
  onClose,
  buyer,
  periodLabel,
  currency,
  paymentInfo,
  businessName,
  logoUrl,
  themeColor
}) => {
  const theme = getTheme(themeColor);
  const [activeTab, setActiveTab] = useState<'ticket' | 'whatsapp' | 'excel'>('ticket');
  const [phone, setPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (buyer) {
      setPhone(buyer.telefono || '');
      const msg = generateWhatsAppMessage(buyer, periodLabel, currency, paymentInfo, businessName);
      setCustomMessage(msg);
      // Generate canvas receipt image
      setTimeout(drawReceiptCanvas, 60);
    }
  }, [buyer, periodLabel, currency, paymentInfo, businessName, logoUrl, themeColor]);

  if (!isOpen || !buyer) return null;

  const drawReceiptCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High resolution canvas (640 x 920)
    canvas.width = 640;
    canvas.height = 920;

    // Background clean white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header gradient from theme
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, theme.canvasPrimaryHex);
    grad.addColorStop(1, theme.canvasSecondaryHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 140);

    // Draw logo if exists
    let headerTextY = 55;
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Circle logo container
          ctx.save();
          ctx.beginPath();
          ctx.arc(60, 70, 36, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.clip();
          ctx.drawImage(img, 24, 34, 72, 72);
          ctx.restore();
        };
        img.src = logoUrl;
      } catch (e) {}
    }

    // Header title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(businessName.toUpperCase(), canvas.width / 2, headerTextY);

    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`ESTADO DE CUENTA & COBRANZA • ${periodLabel.toUpperCase()}`, canvas.width / 2, headerTextY + 28);

    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(`Emisión: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, canvas.width / 2, headerTextY + 48);

    // Buyer info card
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(30, 160, 580, 80, 14);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('CLIENTE / COMPRADOR:', 50, 186);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'black 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(buyer.nombre, 50, 218);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('TELÉFONO:', 590, 186);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(buyer.telefono || 'Sin registrar', 590, 218);

    // Products table header
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(30, 258, 580, 34);
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('PRODUCTO QUE SE LLEVÓ', 48, 280);
    ctx.textAlign = 'center';
    ctx.fillText('CANTIDAD', 440, 280);
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL', 590, 280);

    // Itemized lines
    let y = 320;
    const items = Object.entries(buyer.productosDesglose);
    ctx.font = '13px system-ui, -apple-system, sans-serif';

    items.slice(0, 8).forEach(([prod, info]) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(prod, 48, y);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${info.cantidad} uds`, 440, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'black 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${currency}${info.total.toFixed(2)}`, 590, y);

      // Light row divider
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, y + 10);
      ctx.lineTo(610, y + 10);
      ctx.stroke();

      y += 32;
    });

    if (items.length > 8) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`+ y ${items.length - 8} productos más...`, 48, y);
      y += 24;
    }

    // Totals Section
    y += 15;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Total consumido en el periodo:', 48, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(formatMoney(buyer.totalMonto, currency), 590, y);

    y += 22;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#047857';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Total ya pagado / abonado:', 48, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(formatMoney(buyer.montoPagado, currency), 590, y);

    // List recent abonos (if any)
    if (buyer.pagos && buyer.pagos.length > 0) {
      buyer.pagos.slice(0, 2).forEach(p => {
        y += 18;
        const pDate = new Date(p.fecha);
        const pTimeStr = `${pDate.toLocaleDateString()} ${pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#059669';
        ctx.font = 'italic 11px system-ui, -apple-system, sans-serif';
        const saldoMsg = typeof p.saldoRestante === 'number' ? ` (Restó: ${currency}${p.saldoRestante.toFixed(2)})` : '';
        ctx.fillText(`   ↳ Abono: +${currency}${p.monto.toFixed(2)} [${p.metodo} - ${pTimeStr}]${saldoMsg}`, 48, y);
      });
    }

    // PROMINENT DEBT BOX (CUÁNTO DEBE / FALTA POR PAGAR)
    y += 20;
    const hasDebt = buyer.montoPendiente > 0;
    ctx.fillStyle = hasDebt ? '#fff1f2' : '#f0fdf4';
    ctx.beginPath();
    ctx.roundRect(30, y, 580, 68, 14);
    ctx.fill();
    ctx.strokeStyle = hasDebt ? '#f43f5e' : '#22c55e';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = hasDebt ? '#be123c' : '#15803d';
    ctx.font = 'black 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(hasDebt ? '🔴 CUÁNTO DEBE (FALTA POR PAGAR):' : '🟢 ESTADO DE CUENTA:', 50, y + 40);

    ctx.textAlign = 'right';
    ctx.font = 'black 26px system-ui, -apple-system, sans-serif';
    ctx.fillText(hasDebt ? formatMoney(buyer.montoPendiente, currency) : '¡TOTALMENTE AL DÍA ✓!', 590, y + 44);

    // BOX DE PAGO MÓVIL
    y += 85;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(30, y, 580, 140, 14);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'black 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('💳 DATOS PARA REALIZAR EL PAGO MÓVIL / TRANSFERENCIA:', 48, y + 26);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#334155';
    if (paymentInfo) {
      const pLines = paymentInfo.split('\n');
      pLines.slice(0, 5).forEach((line, idx) => {
        ctx.fillText(line, 48, y + 50 + (idx * 18));
      });
    } else {
      ctx.fillText('Solicita los datos de Pago Móvil al titular.', 48, y + 50);
    }

    // Footer note
    y += 165;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Al realizar tu Pago Móvil por favor envía el comprobante por WhatsApp. ¡Muchas gracias! 😊', canvas.width / 2, y);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(customMessage);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const cleanDigits = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(customMessage);
    const url = cleanDigits
      ? `https://wa.me/${cleanDigits}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadTicketImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `Cuenta_${buyer.nombre.replace(/\s+/g, '_')}_PagoMovil.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyTicketImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      });
    } catch {
      handleDownloadTicketImage();
    }
  };

  const handleExportIndividualExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      { 'Concepto': 'Cliente', 'Detalle': buyer.nombre },
      { 'Concepto': 'Teléfono', 'Detalle': buyer.telefono || '-' },
      { 'Concepto': 'Periodo', 'Detalle': periodLabel },
      { 'Concepto': 'Total Productos Consumidos', 'Detalle': buyer.totalProductos },
      { [`Total Consumido (${currency})`]: buyer.totalMonto },
      { [`Total Pagado / Abonado (${currency})`]: buyer.montoPagado },
      { [`CUÁNTO DEBE (${currency})`]: buyer.montoPendiente },
      { 'Estado': buyer.montoPendiente > 0 ? 'CON SALDO PENDIENTE' : 'AL DÍA' }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Cuenta');

    const ordersData = buyer.ordenes.map((o, idx) => ({
      '#': idx + 1,
      'Fecha': new Date(o.fecha).toLocaleDateString(),
      'Hora': new Date(o.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'Producto(s)': o.producto,
      'Cantidad': o.cantidad || 1,
      [`Monto (${currency})`]: o.monto,
      'Estado': o.estadoPago === 'pagado' ? 'PAGADO' : 'PENDIENTE'
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Detalle Consumos');

    const filename = `Cuenta_${buyer.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Sheet for payments / abonos received
    if (buyer.pagos && buyer.pagos.length > 0) {
      const paymentsData = buyer.pagos.map((p, idx) => ({
        '#': idx + 1,
        'Fecha': new Date(p.fecha).toLocaleDateString(),
        'Hora': new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Método': p.metodo,
        [`Abono Recibido (${currency})`]: p.monto,
        [`Saldo que le restó (${currency})`]: typeof p.saldoRestante === 'number' ? p.saldoRestante : '-',
        'Nota': p.nota || ''
      }));
      const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(wb, wsPayments, 'Abonos Recibidos');
    }

    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme.gradientHeader} px-6 py-4 text-white flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Estado de Cuenta de {buyer.nombre}</h3>
              <p className="text-xs text-white/90">Imagen digital con productos, cuánto debe y Pago Móvil para WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 p-1.5 gap-1.5 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('ticket');
              setTimeout(drawReceiptCanvas, 60);
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'ticket'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            📸 Imagen para WhatsApp (Con Pago Móvil)
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            Texto de WhatsApp
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'excel'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Excel
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          
          {/* Quick Balance Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium block">Total consumido:</span>
              <span className="text-sm font-bold text-slate-900">{formatMoney(buyer.totalMonto, currency)}</span>
            </div>

            <div>
              <span className="text-xs text-emerald-700 font-medium block">Ya pagó:</span>
              <span className="text-sm font-bold text-emerald-700">{formatMoney(buyer.montoPagado, currency)}</span>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 block">
                Cuánto debe
              </span>
              <span className="text-lg font-black text-rose-600">
                {formatMoney(buyer.montoPendiente, currency)}
              </span>
            </div>
          </div>

          {/* TAB 1: IMAGEN DE COMPROBANTE PARA WHATSAPP */}
          {activeTab === 'ticket' && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-slate-500">
                Esta imagen contiene el desglose exacto de los productos consumidos, el monto que debe y los datos completos de Pago Móvil.
              </p>

              <div className="inline-block p-2 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner max-w-full overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full max-w-md rounded-xl shadow-md bg-white mx-auto"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleCopyTicketImage}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                >
                  {copiedImage ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedImage ? '¡Imagen Copiada al Portapapeles!' : 'Copiar Imagen (Pegar en WhatsApp)'}
                </button>

                <button
                  onClick={handleDownloadTicketImage}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar Imagen PNG
                </button>

                <button
                  onClick={handleSendWhatsApp}
                  className="px-4 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP DIRECTO */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  Número de WhatsApp del comprador:
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 04140153904"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mensaje formateado listo para enviar:
                  </label>
                  <button
                    onClick={handleCopyText}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText ? '¡Copiado!' : 'Copiar texto'}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <button
                onClick={handleSendWhatsApp}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Abrir WhatsApp y Enviar a {buyer.nombre}
              </button>
            </div>
          )}

          {/* TAB 3: EXCEL INDIVIDUAL */}
          {activeTab === 'excel' && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Estado de Cuenta en Hoja de Cálculo (.xlsx)
                </h4>
                <p className="text-xs text-emerald-800">
                  Descarga un archivo Excel exclusivo para <strong>{buyer.nombre}</strong> con su resumen de deuda y lista detallada de consumos.
                </p>
              </div>

              <button
                onClick={handleExportIndividualExcel}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                Descargar Excel de {buyer.nombre} (.xlsx)
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
