import React, { useState, useMemo } from 'react';
import { 
  Calendar, FileSpreadsheet, MessageSquare, Check, X, Search, 
  ChevronDown, ChevronUp, DollarSign, Users, AlertCircle, 
  TrendingUp, Radio, CheckCircle2, RefreshCw, Download, ArrowUpRight,
  PlusCircle, CreditCard, Trash2, Share2, Receipt, Clock, Upload, Pencil,
  AlertTriangle
} from 'lucide-react';
import { AppSettings, BuyerSummary, OrderRecord, PaymentRecord } from '../types';
import { 
  getQuincenaOptions, filterOrdersByDate, groupOrdersByBuyer 
} from '../utils/quincena';
import { exportOrdersToExcel } from '../utils/excelExport';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ExportAccountModal } from './ExportAccountModal';
import { EditOrderModal } from './EditOrderModal';
import { formatMoney } from '../utils/format';

interface QuincenaViewProps {
  orders: OrderRecord[];
  payments: PaymentRecord[];
  settings: AppSettings;
  onUpdateOrderStatus: (orderId: string, isPaid: boolean) => Promise<void>;
  onUpdateOrder: (orderId: string, updates: Partial<OrderRecord>) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onBulkSettleBuyer: (buyerName: string, isPaid: boolean) => Promise<void>;
  onRecordPayment: (paymentData: {
    nombre: string;
    monto: number;
    metodo: string;
    nota?: string;
    fecha?: string;
    saldoRestante?: number;
  }) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  onOpenNfcGuide: () => void;
  onOpenGoogleSheet: () => void;
  onOpenImportXLSX?: () => void;
  onOpenResetData?: () => void;
}

export const QuincenaView: React.FC<QuincenaViewProps> = ({
  orders,
  payments,
  settings,
  onUpdateOrderStatus,
  onUpdateOrder,
  onDeleteOrder,
  onBulkSettleBuyer,
  onRecordPayment,
  onDeletePayment,
  onOpenNfcGuide,
  onOpenGoogleSheet,
  onOpenImportXLSX,
  onOpenResetData
}) => {
  const quincenaOptions = useMemo(() => getQuincenaOptions(), []);
  
  // Active selected period
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    quincenaOptions[0]?.id || 'all-orders'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [expandedBuyers, setExpandedBuyers] = useState<Record<string, boolean>>({});
  const [showPaymentsLog, setShowPaymentsLog] = useState(false);

  // Modals state
  const [paymentModalBuyer, setPaymentModalBuyer] = useState<BuyerSummary | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [exportModalBuyer, setExportModalBuyer] = useState<BuyerSummary | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

  // Active period label and dates
  const selectedPeriod = useMemo(() => {
    return quincenaOptions.find(q => q.id === selectedPeriodId);
  }, [quincenaOptions, selectedPeriodId]);

  const periodLabel = useMemo(() => {
    if (selectedPeriodId === 'all-unpaid') return 'Todas las Deudas Pendientes';
    if (selectedPeriodId === 'all-orders') return 'Historial Completo';
    return selectedPeriod?.label || 'Quincena';
  }, [selectedPeriodId, selectedPeriod]);

  // Filter orders according to selected period
  const periodOrders = useMemo(() => {
    if (selectedPeriodId === 'all-unpaid') {
      return orders.filter(o => o.estadoPago !== 'pagado');
    }
    if (selectedPeriodId === 'all-orders') {
      return orders;
    }
    if (selectedPeriod) {
      return filterOrdersByDate(orders, selectedPeriod.startDate, selectedPeriod.endDate);
    }
    return orders;
  }, [orders, selectedPeriodId, selectedPeriod]);

  // Group by buyer including payment records
  const buyersSummary = useMemo(() => {
    return groupOrdersByBuyer(periodOrders, payments);
  }, [periodOrders, payments]);

  // Metrics
  const metrics = useMemo(() => {
    let porCobrar = 0;
    let yaCobrado = 0;
    let totalItems = 0;
    let deudoresCount = 0;

    for (const b of buyersSummary) {
      porCobrar += b.montoPendiente;
      yaCobrado += b.montoPagado;
      totalItems += b.totalProductos;
      if (b.montoPendiente > 0) deudoresCount++;
    }

    return {
      porCobrar: Math.round(porCobrar * 100) / 100,
      yaCobrado: Math.round(yaCobrado * 100) / 100,
      totalMonto: Math.round((porCobrar + yaCobrado) * 100) / 100,
      totalItems,
      deudoresCount,
      totalCompradores: buyersSummary.length
    };
  }, [buyersSummary]);

  // Filtered buyers list
  const filteredBuyers = useMemo(() => {
    return buyersSummary.filter(b => {
      const matchSearch = 
        b.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.telefono.includes(searchQuery);

      if (!matchSearch) return false;

      if (statusFilter === 'unpaid') return b.montoPendiente > 0;
      if (statusFilter === 'paid') return b.montoPendiente === 0;
      return true;
    });
  }, [buyersSummary, searchQuery, statusFilter]);

  const toggleExpand = (buyerName: string) => {
    setExpandedBuyers(prev => ({
      ...prev,
      [buyerName]: !prev[buyerName]
    }));
  };

  const handleExportExcel = () => {
    exportOrdersToExcel(periodOrders, buyersSummary, periodLabel, settings.currency);
  };

  const openRecordPaymentForBuyer = (b: BuyerSummary | null) => {
    setPaymentModalBuyer(b);
    setIsRecordPaymentOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            Cobranzas y Cuentas Claras
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            ¿Quién me pagó y qué falta por pagar?
          </h2>
          <p className="text-xs text-slate-500">
            Registra los abonos recibidos, visualiza saldos pendientes y exporta o importa datos en Excel (.xlsx).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Main Action: Registrar Pago */}
          <button
            onClick={() => openRecordPaymentForBuyer(null)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            + Registrar Quién Me Pagó
          </button>

          {/* New Action: Adjuntar / Importar XLSX */}
          {onOpenImportXLSX && (
            <button
              onClick={onOpenImportXLSX}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-emerald-300 transition-colors shadow-xs"
              title="Adjuntar archivo XLSX y cargar datos automáticamente"
            >
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Importar XLSX</span>
            </button>
          )}

          {/* Acción destructiva: borrar todo el historial */}
          {onOpenResetData && (
            <button
              onClick={onOpenResetData}
              className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-rose-200 transition-colors shadow-xs"
              title="Borrar todo el historial de ventas, deudas y abonos"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Borrar todo</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
            title="Descargar tabla en Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            onClick={onOpenGoogleSheet}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Hoja</span>
          </button>

          <button
            onClick={onOpenNfcGuide}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
          >
            <Radio className="w-4 h-4 text-teal-600" />
            <span className="hidden sm:inline">NFC / QR</span>
          </button>
        </div>
      </div>

      {/* Period Selector Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Calendar className="w-4 h-4 text-emerald-600" />
          Filtrar por Periodo o Quincena:
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedPeriodId('all-unpaid')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedPeriodId === 'all-unpaid'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Solo Deudas Pendientes (Todas)
          </button>

          {quincenaOptions.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedPeriodId(q.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedPeriodId === q.id
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {q.label}
            </button>
          ))}

          <button
            onClick={() => setSelectedPeriodId('all-orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPeriodId === 'all-orders'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Todo el Historial
          </button>
        </div>
      </div>

      {/* KPI Balance Cards: Quién me pagó vs Qué falta por pagar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* Qué falta por pagar */}
        <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl border-2 border-rose-200 shadow-xs space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
            Falta por Cobrar
          </span>
          <p className="text-2xl font-black text-rose-600">
            {formatMoney(metrics.porCobrar, settings.currency)}
          </p>
          <span className="text-[11px] text-rose-800/80 font-semibold block">
            {metrics.deudoresCount} {metrics.deudoresCount === 1 ? 'persona debe' : 'personas deben'}
          </span>
        </div>

        {/* Quién me pagó / Ya cobrado */}
        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border-2 border-emerald-200 shadow-xs space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Quién Me Pagó (Cobrado)
          </span>
          <p className="text-2xl font-black text-emerald-700">
            {formatMoney(metrics.yaCobrado, settings.currency)}
          </p>
          <span className="text-[11px] text-emerald-800/80 font-semibold block">
            {payments.length} abonos / pagos registrados
          </span>
        </div>

        {/* Total Consumido */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Consumido
          </span>
          <p className="text-2xl font-black text-slate-900">
            {formatMoney(metrics.totalMonto, settings.currency)}
          </p>
          <span className="text-[11px] text-slate-500 block">
            {metrics.totalItems} productos retirados
          </span>
        </div>

        {/* Compradores */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Compradores
          </span>
          <p className="text-2xl font-black text-slate-900">
            {metrics.totalCompradores}
          </p>
          <span className="text-[11px] text-slate-500 block">
            {buyersSummary.length - metrics.deudoresCount} personas al día
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar comprador por nombre o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({buyersSummary.length})
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'unpaid'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
            }`}
          >
            Falta por Pagar ({metrics.deudoresCount})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            Al Día ({buyersSummary.length - metrics.deudoresCount})
          </button>
        </div>
      </div>

      {/* Buyers List Cards */}
      {filteredBuyers.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            No hay compradores registrados con este filtro
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Puedes registrar un pago nuevo usando el botón verde superior "+ Registrar Quién Me Pagó".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBuyers.map((buyer) => {
            const isExpanded = !!expandedBuyers[buyer.nombre];
            const hasPending = buyer.montoPendiente > 0;
            const percentPaid = buyer.totalMonto > 0 
              ? Math.min(100, Math.round((buyer.montoPagado / buyer.totalMonto) * 100))
              : 100;

            return (
              <div
                key={buyer.nombre}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  hasPending
                    ? 'border-rose-200 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  
                  {/* Buyer Name & Quick Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center text-sm shadow-xs ${
                        hasPending
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {buyer.nombre.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900">
                          {buyer.nombre}
                        </h4>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            hasPending
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {hasPending ? 'FALTA POR PAGAR' : 'AL DÍA ✓'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{buyer.telefono || 'Sin teléfono'}</span>
                        <span>•</span>
                        <span>{buyer.totalProductos} productos consumidos</span>
                      </div>

                      {/* LISTADO DIRECTO DE PRODUCTOS Y CANTIDADES QUE SE LLEVÓ */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(buyer.productosDesglose).map(([prodName, info]) => (
                          <span
                            key={prodName}
                            className="text-[11px] font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1"
                          >
                            <span className="font-bold text-emerald-700">{info.cantidad}x</span>
                            <span>{prodName}</span>
                            <span className="text-slate-400 font-mono text-[10px]">({formatMoney(info.total, settings.currency)})</span>
                          </span>
                        ))}
                      </div>

                      {/* Mini progress bar of payment */}
                      <div className="w-36 bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${hasPending ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${percentPaid}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Financials & Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    
                    {/* Amount Breakdown Column */}
                    <div className="text-left sm:text-right pr-2">
                      <div className="text-xs text-slate-500 font-medium">
                        Consumió: <span className="font-bold text-slate-800">{formatMoney(buyer.totalMonto, settings.currency)}</span>
                      </div>
                      <div className="text-xs text-emerald-700 font-medium">
                        Pagó: <span className="font-bold">{formatMoney(buyer.montoPagado, settings.currency)}</span>
                      </div>
                      <div className="mt-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                          Cuánto debe
                        </span>
                        <span
                          className={`text-xl font-black ${
                            hasPending ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatMoney(buyer.montoPendiente, settings.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-1.5">
                      
                      {/* Compartir Imagen con Pago Móvil para WhatsApp */}
                      <button
                        onClick={() => setExportModalBuyer(buyer)}
                        className="w-full sm:w-auto px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all active:scale-95"
                        title="Generar imagen para compartir por WhatsApp con Pago Móvil"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        📸 Imagen WhatsApp (Pago Móvil)
                      </button>

                      {/* Registrar Pago */}
                      <button
                        onClick={() => openRecordPaymentForBuyer(buyer)}
                        className="w-full sm:w-auto px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1 border border-emerald-200 transition-colors"
                        title="Registrar un pago o abono recibido"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        Registrar Pago
                      </button>

                      {/* Expand details */}
                      <button
                        onClick={() => toggleExpand(buyer.nombre)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Ver detalle de consumo y abonos"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 space-y-4 animate-in fade-in duration-150">
                    
                    {/* Products breakdown */}
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Productos consumidos por {buyer.nombre}:
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(buyer.productosDesglose).map(([prodName, info]) => (
                          <div
                            key={prodName}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-slate-800 truncate pr-2">
                              {info.cantidad}x {prodName}
                            </span>
                            <span className="font-bold text-slate-900 shrink-0">
                              {formatMoney(info.total, settings.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pagos / Abonos realizados */}
                    {buyer.pagos && buyer.pagos.length > 0 && (
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Historial de Abonos y Pagos Realizados ({buyer.pagos.length}):
                        </h5>
                        <div className="space-y-1.5">
                          {buyer.pagos.map((pay) => {
                            const pDate = new Date(pay.fecha);
                            return (
                              <div
                                key={pay.id}
                                className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-[11px] bg-white text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-emerald-600" />
                                    {pDate.toLocaleDateString()} {pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="font-bold text-emerald-950 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                    {pay.metodo}
                                  </span>
                                  {pay.nota && (
                                    <span className="text-slate-600 italic">({pay.nota})</span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-slate-500">Abonó:</span>
                                    <span className="font-black text-emerald-800 text-sm">
                                      +{formatMoney(pay.monto, settings.currency)}
                                    </span>
                                  </div>

                                  {typeof pay.saldoRestante === 'number' && (
                                    <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-semibold">
                                      Le quedó: <strong className={pay.saldoRestante > 0 ? 'text-rose-600' : 'text-emerald-700'}>{formatMoney(pay.saldoRestante, settings.currency)}</strong>
                                    </span>
                                  )}

                                  <button
                                    onClick={() => onDeletePayment(pay.id)}
                                    className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                                    title="Eliminar este abono"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Orders log */}
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Fechas y horas de cada consumo registrado:
                      </h5>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {buyer.ordenes.map((ord) => {
                          const isOrdPaid = ord.estadoPago === 'pagado';
                          const dt = new Date(ord.fecha);
                          return (
                            <div
                              key={ord.id}
                              className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="font-medium text-slate-800">
                                  {ord.producto}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-900">
                                  {formatMoney(ord.monto, settings.currency)}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => onUpdateOrderStatus(ord.id, !isOrdPaid)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      isOrdPaid
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                    }`}
                                  >
                                    {isOrdPaid ? '✓ Liquidado' : 'Pendiente'}
                                  </button>

                                  <button
                                    onClick={() => setEditingOrder(ord)}
                                    className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                    title="Modificar producto, cantidad o precio"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => onDeleteOrder(ord.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Eliminar este consumo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Historial General de Pagos Recibidos Drawer */}
      {payments.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <button
            onClick={() => setShowPaymentsLog(!showPaymentsLog)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Libro de Pagos y Abonos Recibidos ({payments.length})
              </h3>
            </div>
            <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
              {showPaymentsLog ? 'Ocultar' : 'Ver todos'}
              {showPaymentsLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showPaymentsLog && (
            <div className="divide-y divide-slate-100 pt-2 animate-in fade-in duration-150">
              {payments.map((p) => {
                const pDate = new Date(p.fecha);
                return (
                  <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{p.nombre}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-medium">
                        {p.metodo}
                      </span>
                      {p.nota && <span className="text-slate-400 italic text-[11px]">({p.nota})</span>}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {pDate.toLocaleDateString()} {pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-black text-emerald-700 text-sm">
                        +{formatMoney(p.monto, settings.currency)}
                      </span>
                      {typeof p.saldoRestante === 'number' && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-semibold">
                          Le quedó: <strong className={p.saldoRestante > 0 ? 'text-rose-600' : 'text-emerald-700'}>{formatMoney(p.saldoRestante, settings.currency)}</strong>
                        </span>
                      )}
                      <button
                        onClick={() => onDeletePayment(p.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Eliminar registro de abono"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Registrar Quién Me Pagó */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => {
          setIsRecordPaymentOpen(false);
          setPaymentModalBuyer(null);
        }}
        buyer={paymentModalBuyer}
        currency={settings.currency}
        allBuyers={buyersSummary}
        onSavePayment={onRecordPayment}
      />

      {/* Modal: Exportar Cuenta de la Persona para WhatsApp */}
      <ExportAccountModal
        isOpen={!!exportModalBuyer}
        onClose={() => setExportModalBuyer(null)}
        buyer={exportModalBuyer}
        periodLabel={periodLabel}
        currency={settings.currency}
        paymentInfo={settings.paymentInfo}
        businessName={settings.businessName}
        logoUrl={settings.logoUrl}
        themeColor={settings.themeColor}
      />

      {/* Modal: Modificar pedido / producto */}
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
