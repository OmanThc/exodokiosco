import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Calendar, ListOrdered, Package, Settings, 
  Radio, LogOut, Lock, ArrowLeft, ExternalLink, ShieldCheck, 
  CheckCircle2, Sparkles, RefreshCw, Upload, FileSpreadsheet
} from 'lucide-react';
import { AppSettings, CatalogProduct, OrderRecord, PaymentRecord } from './types';
import { 
  fetchInitialData, updateOrder, deleteOrder, bulkSettleBuyerOrders, 
  saveProductsCatalog, saveAppSettings, recordPayment, deletePayment, resetAllData 
} from './services/api';

import { KioskView } from './components/KioskView';
import { QuincenaView } from './components/QuincenaView';
import { OrdersListView } from './components/OrdersListView';
import { CatalogView } from './components/CatalogView';
import { SettingsView } from './components/SettingsView';
import { NfcGuideModal } from './components/NfcGuideModal';
import { GoogleSheetModal } from './components/GoogleSheetModal';
import { AdminPinModal } from './components/AdminPinModal';
import { ImportXLSXModal } from './components/ImportXLSXModal';
import { ResetDataModal } from './components/ResetDataModal';
import { getEffectiveCustomColors } from './utils/theme';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    scriptUrl: '',
    currency: '$',
    businessName: 'Kiosco & Frigobar de Confianza',
    businessSubtitle: 'Acerca tu celular al NFC, anota lo que te llevas y paga en la quincena',
    paymentInfo: 'Transferencia / Pago Móvil: 04140153904 / Andrés Omaña',
    adminPin: '4520091'
  });

  // Current view mode: 'kiosk' (public NFC view) or 'admin' (owner dashboard)
  const [viewMode, setViewMode] = useState<'kiosk' | 'admin'>('kiosk');
  const [adminTab, setAdminTab] = useState<'quincena' | 'orders' | 'catalog' | 'settings'>('quincena');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Modals
  const [showPinModal, setShowPinModal] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function init() {
      try {
        const data = await fetchInitialData();
        setOrders(data.orders || []);
        setProducts(data.products || []);
        setPayments(data.payments || []);
        setSettings(data.settings);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Extract recent unique buyers for quick selection in Kiosk
  const recentBuyers = useMemo(() => {
    const map = new Map<string, { nombre: string; telefono: string }>();
    for (const ord of orders) {
      const key = ord.nombre.toLowerCase().trim();
      if (key && !map.has(key)) {
        map.set(key, { nombre: ord.nombre.trim(), telefono: ord.telefono || '' });
      }
    }
    return Array.from(map.values());
  }, [orders]);

  // Handler when a new order is registered via NFC Kiosk
  const handleOrderCreated = (newOrder: OrderRecord) => {
    setOrders(prev => [newOrder, ...prev]);
    // Deduct stock in local products state
    if (newOrder.items && newOrder.items.length > 0) {
      setProducts(prev => prev.map(p => {
        const itemBought = newOrder.items?.find(
          it => it.nombre.toLowerCase().trim() === p.nombre.toLowerCase().trim()
        );
        if (itemBought) {
          const qty = itemBought.cantidad || 1;
          const sNev = Math.max(0, (p.stockNevera ?? 10) - qty);
          const sDep = p.stockDeposito ?? 20;
          return {
            ...p,
            stockNevera: sNev,
            stock: sNev + sDep
          };
        }
        return p;
      }));
    }
  };

  // Handler to update an order payment status
  const handleUpdateOrderStatus = async (orderId: string, isPaid: boolean) => {
    const newStatus = isPaid ? 'pagado' : 'pendiente';
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, estadoPago: newStatus, fechaPago: isPaid ? new Date().toISOString() : undefined } : o))
    );
    await updateOrder(orderId, { estadoPago: newStatus });
  };

  // Handler to bulk settle all orders for a buyer
  const handleBulkSettleBuyer = async (buyerName: string, isPaid: boolean) => {
    const newStatus = isPaid ? 'pagado' : 'pendiente';
    setOrders(prev =>
      prev.map(o => {
        if (o.nombre.toLowerCase().trim() === buyerName.toLowerCase().trim()) {
          return { ...o, estadoPago: newStatus, fechaPago: isPaid ? new Date().toISOString() : undefined };
        }
        return o;
      })
    );
    await bulkSettleBuyerOrders(buyerName, newStatus);
  };

  // Handler to delete an order
  const handleDeleteOrder = async (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    await deleteOrder(orderId);
  };

  // Handler to update a full order (productos, precios, cantidades, etc.)
  const handleUpdateOrder = async (orderId: string, updates: Partial<OrderRecord>) => {
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...updates } : o)));
    await updateOrder(orderId, updates);
  };

  // Handler to BORRAR todo el historial (ventas/deudas y/o abonos)
  const handleResetData = async (options: { clearOrders: boolean; clearPayments: boolean }) => {
    const res = await resetAllData(options);
    if (res.success) {
      if (options.clearOrders) setOrders([]);
      if (options.clearPayments) setPayments([]);
      return { ok: true, message: res.message };
    }
    return { ok: false, message: res.message || 'No se pudo borrar el historial.' };
  };

  const totalMontoOrders = useMemo(
    () => orders.reduce((acc, o) => acc + (o.monto || 0), 0),
    [orders]
  );
  const totalAbonadoPayments = useMemo(
    () => payments.reduce((acc, p) => acc + (p.monto || 0), 0),
    [payments]
  );

  // Handler to record payment (quien me pago / abono a deuda)
  const handleRecordPayment = async (paymentData: {
    nombre: string;
    monto: number;
    metodo: string;
    nota?: string;
    fecha?: string;
    saldoRestante?: number;
  }) => {
    const res = await recordPayment(paymentData);
    if (res.success && res.payment) {
      setPayments(prev => [res.payment!, ...prev]);
    }
  };

  // Handler to delete a payment
  const handleDeletePayment = async (paymentId: string) => {
    setPayments(prev => prev.filter(p => p.id !== paymentId));
    await deletePayment(paymentId);
  };

  // Handler to save products catalog
  const handleSaveProducts = async (updatedProducts: CatalogProduct[]) => {
    setProducts(updatedProducts);
    await saveProductsCatalog(updatedProducts);
  };

  // Handler to save app settings
  const handleSaveSettings = async (updatedSettings: AppSettings) => {
    setSettings(updatedSettings);
    await saveAppSettings(updatedSettings);
  };

  // Handler when XLSX import finishes
  const handleImportSuccess = (importedOrders: OrderRecord[], importedPayments: PaymentRecord[]) => {
    setOrders(importedOrders);
    setPayments(importedPayments);
  };

  // Open Admin View with PIN check
  const handleOpenAdmin = () => {
    if (isAdminAuthenticated) {
      setViewMode('admin');
    } else {
      setShowPinModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto animate-pulse">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-slate-600 tracking-wider uppercase">
            Cargando sistema del Kiosco...
          </p>
        </div>
      </div>
    );
  }

  // If in Kiosk view (Self-checkout for NFC)
  if (viewMode === 'kiosk') {
    const customColors = getEffectiveCustomColors(settings.customColors);

    return (
      <div 
        className="min-h-screen text-slate-900 flex flex-col justify-between transition-colors duration-200"
        style={{ backgroundColor: customColors.appBackground }}
      >
        <header className="bg-slate-950/95 backdrop-blur-md text-white px-4 py-2.5 shadow-md border-b border-slate-800 sticky top-0 z-30">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">
                {settings.businessName} • Kiosco NFC
              </span>
            </div>

            {/* Acceso Administrador en el Header */}
            <button
              onClick={handleOpenAdmin}
              style={{
                backgroundColor: customColors.adminButtonBg,
                color: customColors.adminButtonText
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95 border border-white/20 hover:opacity-90 cursor-pointer"
              title="Ingresar al Panel de Administrador"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Acceso Administrador</span>
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
          <KioskView
            products={products}
            settings={settings}
            recentBuyers={recentBuyers}
            existingOrders={orders}
            onOrderCreated={handleOrderCreated}
          />
        </main>

        <AdminPinModal
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          correctPin={settings.adminPin}
          onSuccess={() => {
            setIsAdminAuthenticated(true);
            setViewMode('admin');
          }}
        />
      </div>
    );
  }

  // Admin View (Cobranza quincenal, historial, catálogo, configuración)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      
      {/* Admin Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('kiosk')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Volver al modo Kiosco NFC"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Modo Kiosco</span>
            </button>

            <div className="border-l border-slate-700 pl-3">
              <h1 className="text-sm font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Panel Administrador • {settings.businessName}
              </h1>
              <p className="text-[10px] text-slate-400">
                Gestión de cuentas quincenales, cobranza por WhatsApp y Google Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Adjuntar y cargar archivo XLSX"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar XLSX</span>
            </button>

            <button
              onClick={() => setShowNfcModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
            >
              <Radio className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Configurar</span> NFC / QR
            </button>

            <button
              onClick={() => {
                setIsAdminAuthenticated(false);
                setViewMode('kiosk');
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Cerrar sesión de administrador"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="bg-slate-800 border-t border-slate-700/60 px-4">
          <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setAdminTab('quincena')}
              className={`py-2.5 px-3.5 text-xs font-bold rounded-t-lg flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                adminTab === 'quincena'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Cierre Quincenal (Cobranza)
            </button>

            <button
              onClick={() => setAdminTab('orders')}
              className={`py-2.5 px-3.5 text-xs font-bold rounded-t-lg flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                adminTab === 'orders'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              Historial de Ventas ({orders.length})
            </button>

            <button
              onClick={() => setAdminTab('catalog')}
              className={`py-2.5 px-3.5 text-xs font-bold rounded-t-lg flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                adminTab === 'catalog'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              Catálogo & Inventario Nevera ({products.length})
            </button>

            <button
              onClick={() => setAdminTab('settings')}
              className={`py-2.5 px-3.5 text-xs font-bold rounded-t-lg flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                adminTab === 'settings'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              Configuración & Conexiones
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Tab Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {adminTab === 'quincena' && (
          <QuincenaView
            orders={orders}
            payments={payments}
            settings={settings}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
            onBulkSettleBuyer={handleBulkSettleBuyer}
            onRecordPayment={handleRecordPayment}
            onDeletePayment={handleDeletePayment}
            onOpenNfcGuide={() => setShowNfcModal(true)}
            onOpenGoogleSheet={() => setShowSheetModal(true)}
            onOpenImportXLSX={() => setShowImportModal(true)}
            onOpenResetData={() => setShowResetModal(true)}
          />
        )}

        {adminTab === 'orders' && (
          <OrdersListView
            orders={orders}
            settings={settings}
            onUpdateStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
            onUpdateOrder={handleUpdateOrder}
            onOpenImportXLSX={() => setShowImportModal(true)}
            onOpenResetData={() => setShowResetModal(true)}
          />
        )}

        {adminTab === 'catalog' && (
          <CatalogView
            products={products}
            currency={settings.currency}
            themeId={settings.themeColor}
            onSaveProducts={handleSaveProducts}
          />
        )}

        {adminTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onOpenGoogleSheetGuide={() => setShowSheetModal(true)}
            onOpenNfcGuide={() => setShowNfcModal(true)}
            onOpenResetData={() => setShowResetModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      <NfcGuideModal
        isOpen={showNfcModal}
        onClose={() => setShowNfcModal(false)}
        appUrl={window.location.origin}
      />

      <GoogleSheetModal
        isOpen={showSheetModal}
        onClose={() => setShowSheetModal(false)}
        currentScriptUrl={settings.scriptUrl}
        onSaveScriptUrl={async (url) => {
          const updated = { ...settings, scriptUrl: url };
          setSettings(updated);
          await saveAppSettings(updated);
        }}
      />

      <ImportXLSXModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        currency={settings.currency}
        onImportSuccess={handleImportSuccess}
      />

      <ResetDataModal
        isOpen={showResetModal}
        ordersCount={orders.length}
        paymentsCount={payments.length}
        totalMonto={totalMontoOrders}
        totalAbonado={totalAbonadoPayments}
        currency={settings.currency}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetData}
      />
    </div>
  );
}
