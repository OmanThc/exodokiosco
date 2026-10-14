import React, { useEffect, useState } from 'react';
import {
  X, AlertTriangle, Trash2, ShieldAlert, Check, Package, DollarSign, Info
} from 'lucide-react';
import { formatMoney } from '../utils/format';

interface ResetDataModalProps {
  isOpen: boolean;
  ordersCount: number;
  paymentsCount: number;
  /** Total consumido (para mostrar el alcance de lo que se borrará) */
  totalMonto?: number;
  /** Total abonado */
  totalAbonado?: number;
  currency: string;
  onClose: () => void;
  onConfirm: (options: { clearOrders: boolean; clearPayments: boolean }) => Promise<{ ok: boolean; message?: string }>;
}

const CONFIRM_WORD = 'BORRAR';

/**
 * Modal de doble confirmación para BORRAR todo el historial:
 * ventas/consumos/deudas y abonos/pagos realizados.
 * Es irreversible, por eso se pide escribir la palabra BORRAR.
 */
export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  ordersCount,
  paymentsCount,
  totalMonto = 0,
  totalAbonado = 0,
  currency,
  onClose,
  onConfirm
}) => {
  const [clearOrders, setClearOrders] = useState(true);
  const [clearPayments, setClearPayments] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClearOrders(ordersCount > 0);
      setClearPayments(paymentsCount > 0);
      setConfirmText('');
      setError(null);
      setIsWorking(false);
    }
  }, [isOpen, ordersCount, paymentsCount]);

  if (!isOpen) return null;

  const nothingSelected = !clearOrders && !clearPayments;
  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD && !nothingSelected && !isWorking;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsWorking(true);
    setError(null);
    try {
      const result = await onConfirm({ clearOrders, clearPayments });
      if (result && result.ok) {
        onClose();
      } else {
        setError(result?.message || 'No se pudo borrar el historial.');
        setIsWorking(false);
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo borrar el historial.');
      setIsWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-3xl shadow-2xl border border-rose-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black">Borrar todo el historial</h3>
              <p className="text-[11px] text-rose-100">Esta acción es irreversible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="p-2 text-rose-100 hover:text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>
              Se eliminarán permanentemente los registros seleccionados. Antes de borrar se guardará un
              <strong> respaldo automático</strong> en el servidor, pero <strong>no podrás deshacerlo desde la app</strong>.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Qué borrar */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">¿Qué quieres borrar?</p>

            <label className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${clearOrders ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
              <input
                type="checkbox"
                checked={clearOrders}
                onChange={(e) => setClearOrders(e.target.checked)}
                className="w-4 h-4 accent-rose-600"
              />
              <Package className="w-4 h-4 text-slate-500" />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-900">Historial de ventas y deudas</p>
                <p className="text-[11px] text-slate-600">
                  {ordersCount} pedido(s)/consumo(s)
                  {totalMonto > 0 && <> · {formatMoney(totalMonto, currency)} consumido</>}
                </p>
              </div>
            </label>

            <label className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${clearPayments ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
              <input
                type="checkbox"
                checked={clearPayments}
                onChange={(e) => setClearPayments(e.target.checked)}
                className="w-4 h-4 accent-rose-600"
              />
              <DollarSign className="w-4 h-4 text-slate-500" />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-900">Abonos y pagos realizados</p>
                <p className="text-[11px] text-slate-600">
                  {paymentsCount} abono(s)/pago(s)
                  {totalAbonado > 0 && <> · {formatMoney(totalAbonado, currency)} cobrado</>}
                </p>
              </div>
            </label>

            {nothingSelected && (
              <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                <Info className="w-3 h-3" /> Selecciona al menos una opción.
              </p>
            )}
          </div>

          {/* Confirmación escrita */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Para confirmar, escribe <span className="text-rose-600">{CONFIRM_WORD}</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold tracking-wider text-slate-900 focus:bg-white focus:border-rose-500 outline-hidden uppercase"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isWorking}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isWorking ? (
              <>Borrando...</>
            ) : (
              <>
                {canConfirm ? <Trash2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                Borrar todo definitivamente
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
