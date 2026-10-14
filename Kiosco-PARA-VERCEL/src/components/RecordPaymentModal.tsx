import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Check, X, CreditCard, Calendar, Clock, 
  User, FileText, AlertCircle, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import { BuyerSummary } from '../types';
import { formatMoney } from '../utils/format';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyer: BuyerSummary | null;
  currency: string;
  allBuyers: BuyerSummary[];
  onSavePayment: (paymentData: {
    nombre: string;
    monto: number;
    metodo: string;
    nota?: string;
    fecha?: string;
    saldoRestante?: number;
  }) => Promise<void>;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  buyer,
  currency,
  allBuyers,
  onSavePayment
}) => {
  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [selectedBuyerName, setSelectedBuyerName] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Pago Móvil');
  const [nota, setNota] = useState('');
  const [fecha, setFecha] = useState(todayDateStr);
  const [hora, setHora] = useState(currentTimeStr);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Selected buyer object
  const currentBuyer = allBuyers.find(
    b => b.nombre.toLowerCase().trim() === selectedBuyerName.toLowerCase().trim()
  ) || buyer;

  useEffect(() => {
    if (buyer) {
      setSelectedBuyerName(buyer.nombre);
      setMonto(buyer.montoPendiente > 0 ? String(buyer.montoPendiente.toFixed(2)) : '');
    } else if (allBuyers.length > 0 && !selectedBuyerName) {
      setSelectedBuyerName(allBuyers[0].nombre);
      setMonto(allBuyers[0].montoPendiente > 0 ? String(allBuyers[0].montoPendiente.toFixed(2)) : '');
    }
  }, [buyer, allBuyers]);

  if (!isOpen) return null;

  const currentDeuda = currentBuyer ? currentBuyer.montoPendiente : 0;
  const montoNum = parseFloat(monto) || 0;
  const saldoRestanteCalculado = Math.max(0, Math.round((currentDeuda - montoNum) * 100) / 100);
  const esAbonoParcial = montoNum > 0 && montoNum < currentDeuda;
  const esPagoTotal = montoNum > 0 && montoNum >= currentDeuda;

  const handleSelectBuyerChange = (name: string) => {
    setSelectedBuyerName(name);
    const found = allBuyers.find(b => b.nombre === name);
    if (found && found.montoPendiente > 0) {
      setMonto(String(found.montoPendiente.toFixed(2)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedBuyerName.trim()) {
      setError('Selecciona o escribe el nombre de la persona que abonó.');
      return;
    }
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresa un monto de abono válido mayor a 0.');
      return;
    }

    // Combine date and time
    let isoTimestamp = new Date().toISOString();
    try {
      const [h, m] = hora.split(':').map(Number);
      const combinedDate = new Date(fecha);
      combinedDate.setHours(h || 0, m || 0, 0, 0);
      isoTimestamp = combinedDate.toISOString();
    } catch {
      isoTimestamp = new Date().toISOString();
    }

    setIsSubmitting(true);
    try {
      await onSavePayment({
        nombre: selectedBuyerName.trim(),
        monto: Math.round(montoNum * 100) / 100,
        metodo,
        nota: nota.trim(),
        fecha: isoTimestamp,
        saldoRestante: saldoRestanteCalculado
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el abono');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-emerald-100 animate-in fade-in zoom-in-95 duration-150 my-4">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-white/20 rounded-2xl shadow-inner">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Registrar Abono o Pago</h3>
              <p className="text-xs text-emerald-100">
                Anota el abono con fecha, hora exacta y cálculo del saldo restante
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Buyer selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              ¿Quién abonó?:
            </label>

            {allBuyers.length > 0 ? (
              <select
                value={selectedBuyerName}
                onChange={(e) => handleSelectBuyerChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
              >
                {allBuyers.map(b => (
                  <option key={b.nombre} value={b.nombre}>
                    {b.nombre} {b.montoPendiente > 0 ? `(Debe: ${formatMoney(b.montoPendiente, currency)})` : '(Al día ✓)'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={selectedBuyerName}
                onChange={(e) => setSelectedBuyerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            )}
          </div>

          {/* Current Debt Card */}
          {currentBuyer && (
            <div className="p-3.5 bg-gradient-to-r from-slate-50 to-rose-50/40 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block font-medium">Deuda total acumulada:</span>
                <span className="font-semibold text-slate-700">Consumo: {formatMoney(currentBuyer.totalMonto, currency)}</span>
                <span className="text-emerald-700 block text-[11px] font-semibold mt-0.5">
                  Ya abonado previamente: {formatMoney(currentBuyer.montoPagado, currency)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                  Debe actualmente
                </span>
                <span className="text-lg font-black text-rose-600">
                  {formatMoney(currentBuyer.montoPendiente, currency)}
                </span>
              </div>
            </div>
          )}

          {/* Amount Abonado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                ¿Cuánto abonó? ({currency}):
              </label>
              {currentBuyer && currentBuyer.montoPendiente > 0 && (
                <button
                  type="button"
                  onClick={() => setMonto(String(currentBuyer.montoPendiente.toFixed(2)))}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline"
                >
                  Pagar toda la deuda ({formatMoney(currentBuyer.montoPendiente, currency)})
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-black text-emerald-700 text-base">{currency}</span>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border-2 border-emerald-500/30 rounded-xl text-lg font-black text-slate-900 focus:bg-white focus:border-emerald-600 outline-hidden"
              />
            </div>

            {/* Quick amount chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[1, 2, 5, 10, 20].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMonto(String(val.toFixed(2)))}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold transition-colors"
                >
                  +{currency}{val.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* REAL TIME CALCULATION: Cuánto abonó y Cuánto le queda por pagar */}
          {montoNum > 0 && currentBuyer && (
            <div className="p-3.5 rounded-2xl border transition-all space-y-2 bg-slate-50 border-emerald-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Deuda antes del abono:</span>
                <span className="font-bold text-slate-800">{formatMoney(currentDeuda, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Abono a registrar:
                </span>
                <span className="font-black text-emerald-700">-{formatMoney(montoNum, currency)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    ¿Cuánto le queda por pagar?
                  </span>
                  <span className="text-xs text-slate-500">
                    {esPagoTotal ? '¡Quedará 100% al día!' : 'Saldo pendiente actualizado'}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black ${saldoRestanteCalculado > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {formatMoney(saldoRestanteCalculado, currency)}
                  </span>
                </div>
              </div>

              {esAbonoParcial && (
                <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl font-medium border border-amber-200/60">
                  ⚡ <strong>Abono Parcial:</strong> El cliente abona antes del cobro y le restarán <strong>{formatMoney(saldoRestanteCalculado, currency)}</strong>.
                </div>
              )}

              {esPagoTotal && (
                <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-xl font-bold border border-emerald-200 flex items-center gap-1">
                  🎉 ¡Genial! Con este abono la deuda queda totalmente saldada.
                </div>
              )}
            </div>
          )}

          {/* Fecha y Hora del Abono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Fecha del abono:
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                Hora del abono:
              </label>
              <input
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              Método del abono recibido:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Pago Móvil', 'Efectivo', 'Transferencia', 'Zelle / Divisas'].map((met) => (
                <button
                  key={met}
                  type="button"
                  onClick={() => setMetodo(met)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    metodo === met
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-600 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {met}
                </button>
              ))}
            </div>
          </div>

          {/* Reference / Note */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Referencia / Nota del abono (opcional):
            </label>
            <input
              type="text"
              placeholder="Ej: Ref #4512 o abono parcial en efectivo"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Guardando Abono...' : 'Asentar Abono'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
