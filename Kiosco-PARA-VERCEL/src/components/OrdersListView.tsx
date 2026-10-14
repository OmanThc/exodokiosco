import React, { useState, useMemo } from 'react';
import {
  Search, Trash2, CheckCircle2, Clock, AlertCircle, 
  ExternalLink, Calendar, Filter, Check, RotateCcw, Upload, Pencil, AlertTriangle
} from 'lucide-react';
import { AppSettings, OrderRecord } from '../types';
import { formatMoney } from '../utils/format';
import { EditOrderModal } from './EditOrderModal';

interface OrdersListViewProps {
  orders: OrderRecord[];
  settings: AppSettings;
  onUpdateStatus: (orderId: string, isPaid: boolean) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onUpdateOrder: (orderId: string, updates: Partial<OrderRecord>) => Promise<void>;
  onOpenImportXLSX?: () => void;
  onOpenResetData?: () => void;
}

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  settings,
  onUpdateStatus,
  onDeleteOrder,
  onUpdateOrder,
  onOpenImportXLSX,
  onOpenResetData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'pagado'>('all');
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = 
        o.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.telefono.includes(searchTerm);

      if (!matchSearch) return false;

      if (statusFilter !== 'all' && o.estadoPago !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchTerm, statusFilter]);

  const handleDelete = async (order: OrderRecord) => {
    if (window.confirm(`¿Seguro que deseas eliminar este registro de ${order.nombre}?`)) {
      await onDeleteOrder(order.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por comprador, producto o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {onOpenImportXLSX && (
            <button
              onClick={onOpenImportXLSX}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all flex items-center gap-1.5 shadow-xs"
              title="Cargar archivo Excel con compras, deudas y abonos"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importar XLSX</span>
            </button>
          )}

          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Todos ({orders.length})
          </button>
          <button
            onClick={() => setStatusFilter('pendiente')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'pendiente'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('pagado')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'pagado'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
          >
            Pagados
          </button>

          {onOpenResetData && (
            <button
              onClick={onOpenResetData}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 transition-all flex items-center justify-center gap-1.5"
              title="Borrar todo el historial de ventas, deudas y abonos"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Borrar todo</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Table / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 text-xs">
          No se encontraron registros con los filtros seleccionados.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Comprador</th>
                  <th className="py-3 px-4">Teléfono</th>
                  <th className="py-3 px-4">Producto(s)</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Estado Pago</th>
                  <th className="py-3 px-4">Google Sheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredOrders.map((order) => {
                  const dt = new Date(order.fecha);
                  const isPaid = order.estadoPago === 'pagado';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        <div>{dt.toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {order.nombre}
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {order.telefono || '-'}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate" title={order.producto}>
                        <span className="font-semibold text-slate-800">{order.producto}</span>
                        {order.cantidad > 1 && (
                          <span className="ml-1 text-slate-400">({order.cantidad} uds)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900 whitespace-nowrap">
                        {formatMoney(order.monto, settings.currency)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onUpdateStatus(order.id, !isPaid)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {isPaid ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {isPaid ? 'Pagado' : 'Pendiente'}
                          </button>

                          <button
                            onClick={() => setEditingOrder(order)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Modificar producto, cantidad o precio"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(order)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar este pedido"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {order.syncStatus === 'synced' ? (
                          <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            Sincronizado
                          </span>
                        ) : order.syncStatus === 'failed' ? (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 w-max" title={order.syncMessage}>
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Pendiente / Error
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium w-max">
                            Local
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para modificar el pedido / productos */}
      <EditOrderModal
        isOpen={!!editingOrder}
        order={editingOrder}
        currency={settings.currency}
        onClose={() => setEditingOrder(null)}
        onSave={onUpdateOrder}
      />
    </div>
  );
};
