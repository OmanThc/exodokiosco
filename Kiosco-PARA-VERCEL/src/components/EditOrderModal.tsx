import React, { useEffect, useState } from 'react';
import {
  X, Plus, Trash2, Package, Save, User, Phone, StickyNote, Clock, Check
} from 'lucide-react';
import { OrderRecord, OrderItem } from '../types';
import { formatMoney } from '../utils/format';

interface EditOrderModalProps {
  isOpen: boolean;
  order: OrderRecord | null;
  currency: string;
  onClose: () => void;
  onSave: (orderId: string, updates: Partial<OrderRecord>) => Promise<void>;
}

interface DraftItem {
  nombre: string;
  precio: number;
  cantidad: number;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Modal para modificar un pedido ya registrado: cambiar el comprador, el
 * teléfono, las notas y sobre todo los PRODUCTOS (nombre, cantidad y precio),
 * además de poder borrar o agregar productos. El total se recalcula solo.
 */
export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  order,
  currency,
  onClose,
  onSave
}) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [estadoPago, setEstadoPago] = useState<'pendiente' | 'pagado'>('pendiente');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar los datos del pedido al abrir
  useEffect(() => {
    if (isOpen && order) {
      setNombre(order.nombre || '');
      setTelefono(order.telefono || '');
      setNotas(order.notas || '');
      setEstadoPago(order.estadoPago || 'pendiente');
      setError(null);

      const base: DraftItem[] =
        Array.isArray(order.items) && order.items.length > 0
          ? order.items.map(it => ({
              nombre: it.nombre || '',
              precio: Number(it.precio) || 0,
              cantidad: Number(it.cantidad) || 1
            }))
          : [{
              nombre: order.producto || 'Consumo',
              precio: order.cantidad && order.cantidad > 0
                ? round2((order.monto || 0) / order.cantidad)
                : (order.monto || 0),
              cantidad: order.cantidad || 1
            }];

      setItems(base);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const total = items.reduce((acc, it) => acc + (Number(it.precio) || 0) * (Number(it.cantidad) || 0), 0);
  const cantidadTotal = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };
  const addItem = () => {
    setItems(prev => [...prev, { nombre: '', precio: 0, cantidad: 1 }]);
  };

  const handleSave = async () => {
    const cleanItems: OrderItem[] = items
      .filter(it => (it.nombre && it.nombre.trim()) || Number(it.precio) > 0)
      .map(it => ({
        nombre: (it.nombre || '').trim() || 'Producto',
        precio: round2(Number(it.precio)),
        cantidad: Math.max(1, Number(it.cantidad) || 1)
      }));

    if (cleanItems.length === 0) {
      setError('Debe quedar al menos un producto. Si quieres quitar todo, usa el botón eliminar del pedido.');
      return;
    }

    const productoTexto = cleanItems
      .map(it => `${it.cantidad > 1 ? it.cantidad + 'x ' : ''}${it.nombre}`)
      .join(', ');

    setIsSaving(true);
    setError(null);
    try {
      await onSave(order.id, {
        nombre: nombre.trim() || order.nombre,
        telefono: telefono.trim(),
        notas: notas.trim(),
        estadoPago,
        fechaPago: estadoPago === 'pagado' ? (order.fechaPago || new Date().toISOString()) : undefined,
        items: cleanItems,
        cantidad: cantidadTotal || 1,
        monto: round2(total),
        producto: productoTexto || order.producto
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black">Modificar Pedido / Productos</h3>
              <p className="text-[11px] text-slate-400">Cambia el producto, la cantidad o el precio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Datos del comprador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <User className="w-3 h-3" /> Comprador
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Teléfono
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
              />
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Package className="w-3 h-3" /> Productos ({items.length})
              </label>
              <button
                type="button"
                onClick={addItem}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Agregar producto
              </button>
            </div>

            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                  No hay productos. Agrega uno para continuar.
                </p>
              )}

              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                  <input
                    type="text"
                    placeholder="Nombre del producto"
                    value={it.nombre}
                    onChange={(e) => updateItem(idx, { nombre: e.target.value })}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      title="Cantidad"
                      value={it.cantidad}
                      onChange={(e) => updateItem(idx, { cantidad: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center text-slate-900 focus:border-emerald-500 outline-hidden"
                    />
                    <span className="text-slate-400 text-xs">×</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      title="Precio unitario"
                      value={it.precio}
                      onChange={(e) => updateItem(idx, { precio: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right text-slate-900 focus:border-emerald-500 outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    title="Quitar este producto"
                    className="shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Estado de pago */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs font-bold text-slate-600">Estado de pago</span>
            <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setEstadoPago('pendiente')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                  estadoPago === 'pendiente' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3 h-3" /> Pendiente
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('pagado')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                  estadoPago === 'pagado' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check className="w-3 h-3" /> Pagado
              </button>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden resize-none"
              placeholder="Observaciones..."
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <span className="text-xs font-bold text-emerald-900">
              Total ({cantidadTotal} producto{cantidadTotal === 1 ? '' : 's'})
            </span>
            <span className="text-lg font-black text-emerald-700">
              {formatMoney(round2(total), currency)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>Guardando...</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar cambios
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
