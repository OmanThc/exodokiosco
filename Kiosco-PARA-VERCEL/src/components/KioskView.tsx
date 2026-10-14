import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShoppingBag, Check, Plus, Minus, Sparkles, User, Phone, 
  HelpCircle, CheckCircle2, ChevronRight, RefreshCw, AlertCircle, ArrowRight,
  Snowflake, CreditCard, Calendar, Copy, MessageSquare, Image as ImageIcon
} from 'lucide-react';
import { AppSettings, CatalogProduct, OrderRecord } from '../types';
import { submitOrder } from '../services/api';
import { playSuccessChime } from '../utils/audio';
import { formatMoney, roundMoney } from '../utils/format';
import { getTheme, getEffectiveCustomColors } from '../utils/theme';

interface KioskViewProps {
  products: CatalogProduct[];
  settings: AppSettings;
  recentBuyers: Array<{ nombre: string; telefono: string }>;
  existingOrders: OrderRecord[];
  onOrderCreated: (order: OrderRecord) => void;
}

export const KioskView: React.FC<KioskViewProps> = ({
  products,
  settings,
  recentBuyers,
  existingOrders,
  onOrderCreated
}) => {
  const theme = getTheme(settings.themeColor);
  const colors = getEffectiveCustomColors(settings.customColors);

  // Form State
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState<string>('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [notas, setNotas] = useState('');

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Payment choice modal state: 'pagar_ahora' | 'pagar_quincena'
  const [showPaymentChoiceModal, setShowPaymentChoiceModal] = useState(false);
  const [copiedBankInfo, setCopiedBankInfo] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<OrderRecord | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.categoria) set.add(p.categoria);
    });
    return ['Todos', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Todos') return products;
    return products.filter(p => p.categoria === selectedCategory);
  }, [products, selectedCategory]);

  // Stepper handlers
  const handleIncrease = (productId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const handleDecrease = (productId: string) => {
    setSelectedItems(prev => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return {
        ...prev,
        [productId]: current - 1
      };
    });
  };

  // Quick select buyer
  const handleSelectRecentBuyer = (buyer: { nombre: string; telefono: string }) => {
    setNombre(buyer.nombre);
    if (buyer.telefono) {
      setTelefono(buyer.telefono);
    }
  };

  // Cart summary calculation
  const cartSummary = useMemo(() => {
    let totalItemsCount = 0;
    let totalPrice = 0;
    const itemsList: Array<{ nombre: string; cantidad: number; precio: number; emoji?: string; imagenUrl?: string }> = [];

    for (const [prodId, qty] of Object.entries(selectedItems)) {
      if (qty <= 0) continue;
      const product = products.find(p => p.id === prodId);
      if (product) {
        totalItemsCount += qty;
        totalPrice += product.precio * qty;
        itemsList.push({
          nombre: product.nombre,
          cantidad: qty,
          precio: product.precio,
          emoji: product.emoji,
          imagenUrl: product.imagenUrl
        });
      }
    }

    if (showCustomItem && customItemName.trim() && customItemPrice) {
      const priceNum = parseFloat(customItemPrice) || 0;
      const qtyNum = customItemQty || 1;
      totalItemsCount += qtyNum;
      totalPrice += priceNum * qtyNum;
      itemsList.push({
        nombre: customItemName.trim(),
        cantidad: qtyNum,
        precio: priceNum,
        emoji: '✨'
      });
    }

    totalPrice = roundMoney(totalPrice);
    return { totalItemsCount, totalPrice, itemsList };
  }, [selectedItems, products, showCustomItem, customItemName, customItemPrice, customItemQty]);

  // Calculate current buyer's total pending debt (including prior orders)
  const buyerPendingDebt = useMemo(() => {
    if (!nombre.trim()) return 0;
    const nameNorm = nombre.trim().toLowerCase();
    const rawDebt = existingOrders
      .filter(o => o.nombre.trim().toLowerCase() === nameNorm && o.estadoPago !== 'pagado')
      .reduce((sum, o) => sum + (o.monto || 0), 0);
    return roundMoney(rawDebt);
  }, [nombre, existingOrders]);

  // Click on "Continuar con mi Compra" -> Validates and opens the 2-Option choice modal
  const handleOpenPaymentChoice = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!nombre.trim()) {
      setErrorMessage('Por favor ingresa tu nombre para saber a quién anotar.');
      return;
    }

    if (cartSummary.totalItemsCount === 0) {
      setErrorMessage('Selecciona al menos un producto tocando el botón +.');
      return;
    }

    setShowPaymentChoiceModal(true);
  };

  // Final submit with choice: 'pagar_ahora' | 'pagar_quincena'
  const handleFinalSubmit = async (tipoPago: 'pagar_ahora' | 'pagar_quincena') => {
    setIsSubmitting(true);
    setErrorMessage('');

    // Summary description
    const productSummary = cartSummary.itemsList
      .map(it => `${it.cantidad}x ${it.nombre}`)
      .join(', ');

    const orderData = {
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      producto: productSummary,
      cantidad: cartSummary.totalItemsCount,
      items: cartSummary.itemsList,
      monto: cartSummary.totalPrice,
      notas: notas.trim(),
      tipoPago,
      estadoPago: tipoPago === 'pagar_ahora' ? ('pendiente' as const) : ('pendiente' as const)
    };

    try {
      const res = await submitOrder(orderData);

      if (res.success && res.order) {
        // Trigger celebratory sound & confetti
        playSuccessChime();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        setShowPaymentChoiceModal(false);
        setLastSubmittedOrder(res.order);
        onOrderCreated(res.order);

        // Reset cart
        setSelectedItems({});
        setShowCustomItem(false);
        setCustomItemName('');
        setCustomItemPrice('');
        setCustomItemQty(1);
        setNotas('');
      } else {
        setErrorMessage(res.message || 'No se pudo guardar la orden.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy Pago Movil info
  const handleCopyBankInfo = () => {
    navigator.clipboard.writeText(settings.paymentInfo);
    setCopiedBankInfo(true);
    setTimeout(() => setCopiedBankInfo(false), 2000);
  };

  // Open WhatsApp to send receipt
  const handleSendPaymentProofWhatsApp = () => {
    if (!lastSubmittedOrder) return;
    const msg = `Hola! Acabo de hacer la compra de ${lastSubmittedOrder.producto} por un monto de ${formatMoney(lastSubmittedOrder.monto, settings.currency)} en ${settings.businessName}. Adjunto comprobante de Pago Móvil. Muchas gracias!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* BRANDING / HEADER CARD WITH EXACT CONFIGURED COLORS & LOGO */}
      <div 
        className="rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden transition-colors"
        style={{
          backgroundColor: colors.headerBg,
          color: colors.headerText
        }}
      >
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left relative z-10">
          
          {/* Logo del negocio */}
          {settings.logoUrl ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={settings.logoUrl}
                alt="Logo del negocio"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner shrink-0">
              ⚡
            </div>
          )}

          <div className="flex-1 space-y-1">
            <div className="flex items-center flex-wrap gap-2">
              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wider uppercase"
                style={{ color: colors.headerText }}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                Kiosco de Confianza & Autoservicio
              </div>
            </div>
            
            <h1 
              className="text-2xl sm:text-3xl font-black tracking-tight leading-tight"
              style={{ color: colors.headerText }}
            >
              {settings.businessName}
            </h1>
            
            <p 
              className="text-xs sm:text-sm font-medium max-w-xl opacity-90"
              style={{ color: colors.headerText }}
            >
              {settings.businessSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* CONFIRMATION / SUCCESS BANNER */}
      {lastSubmittedOrder && (
        <div 
          className="rounded-3xl p-6 sm:p-7 border-2 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
          style={{
            backgroundColor: colors.sectionCardBg,
            borderColor: colors.primaryButtonBg
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
              style={{
                backgroundColor: `${colors.primaryButtonBg}20`,
                color: colors.primaryButtonBg
              }}
            >
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <span 
                className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block"
                style={{
                  backgroundColor: `${colors.primaryButtonBg}15`,
                  color: colors.primaryButtonBg
                }}
              >
                {lastSubmittedOrder.tipoPago === 'pagar_ahora' ? '💳 Pago Inmediato Registrado' : '🗓️ Compra Anotada para el 15'}
              </span>
              <h3 
                className="text-xl font-black mt-1"
                style={{ color: colors.titleText }}
              >
                ¡Gracias, {lastSubmittedOrder.nombre}!
              </h3>
              <p className="text-xs text-slate-500">
                {lastSubmittedOrder.tipoPago === 'pagar_ahora'
                  ? 'Has elegido pagar ahora. Revisa los datos de Pago Móvil abajo para completar tu transferencia.'
                  : 'Tu consumo ha quedado registrado. Pagarás el total acumulado en el corte del día 15.'}
              </p>
            </div>
          </div>

          <div 
            className="p-4 rounded-2xl border space-y-2 text-xs"
            style={{
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder
            }}
          >
            <div className="flex justify-between text-slate-600">
              <span>Monto de esta compra:</span>
              <span 
                className="font-bold text-sm"
                style={{ color: colors.priceAccent }}
              >
                {formatMoney(lastSubmittedOrder.monto, settings.currency)}
              </span>
            </div>

            {lastSubmittedOrder.tipoPago === 'pagar_ahora' ? (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between font-bold" style={{ color: colors.titleText }}>
                  <span>Datos para realizar el Pago Móvil:</span>
                  <button
                    onClick={handleCopyBankInfo}
                    className="text-[11px] bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold hover:bg-slate-50"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedBankInfo ? '¡Copiado!' : 'Copiar datos'}
                  </button>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre-line">
                  {settings.paymentInfo}
                </div>
                <button
                  onClick={handleSendPaymentProofWhatsApp}
                  style={{
                    backgroundColor: colors.primaryButtonBg,
                    color: colors.primaryButtonText
                  }}
                  className="w-full py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 transition-opacity"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Enviar comprobante por WhatsApp
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold block" style={{ color: colors.titleText }}>
                    Total acumulado en tu cuenta:
                  </span>
                  <span className="text-[11px] text-slate-500">A pagar en el corte quincenal</span>
                </div>
                <span 
                  className="text-lg font-black"
                  style={{ color: colors.priceAccent }}
                >
                  {formatMoney(buyerPendingDebt + lastSubmittedOrder.monto, settings.currency)}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setLastSubmittedOrder(null)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Anotar otra compra o persona
          </button>
        </div>
      )}

      {/* FORMULARIO DE COMPRA */}
      <form onSubmit={handleOpenPaymentChoice} className="space-y-6">
        
        {/* PASO 1: IDENTIFICACIÓN */}
        <div 
          className="rounded-3xl p-5 sm:p-6 border shadow-xs space-y-4 transition-colors"
          style={{
            backgroundColor: colors.sectionCardBg,
            borderColor: colors.cardBorder
          }}
        >
          <div className="flex items-center gap-2.5">
            <span 
              className="w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: colors.primaryButtonBg,
                color: colors.primaryButtonText
              }}
            >
              1
            </span>
            <div>
              <h2 className="text-sm font-bold" style={{ color: colors.titleText }}>
                ¿Quién eres? (Tu Identificación)
              </h2>
              <p className="text-xs text-slate-500">Ingresa tu nombre para saber a quién cargar el consumo</p>
            </div>
          </div>

          {/* Compradores recientes */}
          {recentBuyers.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Selección rápida con 1 toque:
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {recentBuyers.map((b) => {
                  const isSelected = nombre.toLowerCase().trim() === b.nombre.toLowerCase().trim();
                  return (
                    <button
                      key={b.nombre}
                      type="button"
                      onClick={() => handleSelectRecentBuyer(b)}
                      style={{
                        backgroundColor: isSelected ? colors.categoryActiveBg : colors.cardBackground,
                        color: isSelected ? colors.categoryActiveText : colors.titleText,
                        borderColor: isSelected ? colors.categoryActiveBg : colors.cardBorder
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shadow-2xs"
                    >
                      👤 {b.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Tu Nombre y Apellido *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Andrés Omaña"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white outline-none font-bold focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Número de WhatsApp (Opcional)
              </label>
              <input
                type="tel"
                placeholder="Ej: 04140153904"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white outline-none font-medium focus:border-emerald-500"
              />
            </div>
          </div>

          {buyerPendingDebt > 0 && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between font-bold">
              <span>Tu saldo acumulado actual sin pagar:</span>
              <span className="text-amber-900 text-sm">
                {formatMoney(buyerPendingDebt, settings.currency)}
              </span>
            </div>
          )}
        </div>

        {/* PASO 2: CATÁLOGO DE PRODUCTOS (CON FOTOS & INDICADOR DE NEVERA) */}
        <div 
          className="rounded-3xl p-5 sm:p-6 border shadow-xs space-y-4 transition-colors"
          style={{
            backgroundColor: colors.sectionCardBg,
            borderColor: colors.cardBorder
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span 
                className="w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shadow-xs"
                style={{
                  backgroundColor: colors.primaryButtonBg,
                  color: colors.primaryButtonText
                }}
              >
                2
              </span>
              <div>
                <h2 className="text-sm font-bold" style={{ color: colors.titleText }}>
                  ¿Qué te estás llevando de la nevera?
                </h2>
                <p className="text-xs text-slate-500">Toca el botón + en los productos que retiraste</p>
              </div>
            </div>

            {cartSummary.totalItemsCount > 0 && (
              <span 
                className="self-start sm:self-auto text-xs font-black px-3 py-1 rounded-full shadow-2xs"
                style={{
                  backgroundColor: `${colors.primaryButtonBg}20`,
                  color: colors.primaryButtonBg
                }}
              >
                {cartSummary.totalItemsCount} {cartSummary.totalItemsCount === 1 ? 'producto elegido' : 'productos elegidos'}
              </span>
            )}
          </div>

          {/* Filtro de Categorías */}
          {categories.length > 2 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      backgroundColor: isActive ? colors.categoryActiveBg : 'rgba(241,245,249,0.8)',
                      color: isActive ? colors.categoryActiveText : '#475569',
                      borderColor: isActive ? colors.categoryActiveBg : colors.cardBorder
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shadow-2xs"
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid de Productos con Foto y Colores Exactos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProducts.map((prod) => {
              const qty = selectedItems[prod.id] || 0;
              const isSelected = qty > 0;
              const nevera = prod.stockNevera ?? 10;
              const isNeveraEmpty = nevera <= 0;

              return (
                <div
                  key={prod.id}
                  className="p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-xs"
                  style={{
                    backgroundColor: colors.cardBackground,
                    borderColor: isSelected ? colors.primaryButtonBg : colors.cardBorder,
                    boxShadow: isSelected ? `0 0 0 2px ${colors.primaryButtonBg}30` : undefined
                  }}
                >
                  {/* Foto o Emoji */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                      {prod.imagenUrl ? (
                        <img
                          src={prod.imagenUrl}
                          alt={prod.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{prod.emoji || '📦'}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p 
                        className="text-xs sm:text-sm font-black truncate"
                        style={{ color: colors.titleText }}
                      >
                        {prod.nombre}
                      </p>

                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span 
                          className="text-xs font-black"
                          style={{ color: colors.priceAccent }}
                        >
                          {formatMoney(prod.precio, settings.currency)}
                        </span>
                        {prod.promo && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md">
                            {prod.promo}
                          </span>
                        )}
                      </div>

                      {/* Indicador de stock en nevera */}
                      <span
                        className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${
                          isNeveraEmpty
                            ? 'text-rose-600'
                            : nevera <= 3
                            ? 'text-amber-600'
                            : 'text-cyan-700'
                        }`}
                      >
                        <Snowflake className="w-2.5 h-2.5" />
                        {isNeveraEmpty ? 'Agotado en nevera' : `${nevera} en nevera`}
                      </span>
                    </div>
                  </div>

                  {/* Stepper (+ / -) con Color Configurado */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => handleDecrease(prod.id)}
                        style={{
                          backgroundColor: colors.stepperButtonBg,
                          color: colors.stepperButtonText
                        }}
                        className="w-8 h-8 rounded-lg font-bold flex items-center justify-center shadow-xs active:scale-95 transition-transform"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isSelected && (
                      <span 
                        className="w-7 text-center font-black text-xs"
                        style={{ color: colors.titleText }}
                      >
                        {qty}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleIncrease(prod.id)}
                      style={{
                        backgroundColor: isSelected ? colors.stepperButtonBg : '#ffffff',
                        color: isSelected ? colors.stepperButtonText : '#1e293b'
                      }}
                      className="w-8 h-8 rounded-lg font-bold flex items-center justify-center shadow-xs transition-transform active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Producto personalizado si no está en la lista */}
          <div className="pt-2 border-t border-slate-100">
            {!showCustomItem ? (
              <button
                type="button"
                onClick={() => setShowCustomItem(true)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                ¿Te llevaste algo que no aparece en la lista? Agrégalo manualmente
              </button>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Artículo Personalizado:</span>
                  <button type="button" onClick={() => setShowCustomItem(false)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del artículo"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Precio unitario (${settings.currency})`}
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(parseInt(e.target.value, 10) || 1)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* BARRA FLOTANTE / INFERIOR DE TOTAL Y CONTINUAR CON COLORES EXACTOS */}
        <div 
          className="p-4 rounded-3xl border shadow-xl sticky bottom-3 space-y-3 z-20 transition-colors"
          style={{
            backgroundColor: colors.sectionCardBg,
            borderColor: colors.cardBorder
          }}
        >
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total a pagar o anotar:
              </span>
              <div className="text-2xl font-black flex items-baseline gap-1" style={{ color: colors.titleText }}>
                <span style={{ color: colors.priceAccent }}>{formatMoney(cartSummary.totalPrice, settings.currency)}</span>
                <span className="text-xs text-slate-400 font-normal ml-1">
                  ({cartSummary.totalItemsCount} {cartSummary.totalItemsCount === 1 ? 'item' : 'items'})
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 block">
                Opciones al continuar:
              </span>
              <span className="text-[11px] font-bold" style={{ color: colors.priceAccent }}>
                Pagar ahora o el 15
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={cartSummary.totalItemsCount === 0 || isSubmitting}
            style={{
              backgroundColor: colors.primaryButtonBg,
              color: colors.primaryButtonText
            }}
            className="w-full py-3.5 disabled:opacity-50 font-black text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <span>Continuar con mi Compra</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </form>

      {/* MODAL DE 2 OPCIONES: PAGAR AHORA vs PAGAR PARA EL 15 (CON COLORES EXACTOS) */}
      {showPaymentChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div 
            className="rounded-3xl max-w-md w-full p-6 shadow-2xl border space-y-5 my-6 animate-in zoom-in-95"
            style={{
              backgroundColor: colors.sectionCardBg,
              borderColor: colors.cardBorder
            }}
          >
            
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <span 
                  className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${colors.primaryButtonBg}15`,
                    color: colors.primaryButtonBg
                  }}
                >
                  Paso Final
                </span>
                <h3 className="text-lg font-black mt-1" style={{ color: colors.titleText }}>
                  ¿Cómo deseas pagar hoy?
                </h3>
                <p className="text-xs text-slate-500">Selecciona una de las 2 opciones disponibles</p>
              </div>
              <button
                onClick={() => setShowPaymentChoiceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Total summary */}
            <div 
              className="p-3 rounded-2xl border flex justify-between items-center text-xs"
              style={{
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder
              }}
            >
              <div>
                <span className="text-slate-500 block">Comprador:</span>
                <span className="font-bold text-sm" style={{ color: colors.titleText }}>{nombre}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Monto a pagar:</span>
                <span className="text-lg font-black" style={{ color: colors.priceAccent }}>
                  {formatMoney(cartSummary.totalPrice, settings.currency)}
                </span>
              </div>
            </div>

            {/* LAS 2 OPCIONES CON BOTONES DE COLOR EXACTO */}
            <div className="space-y-3">
              
              {/* OPCIÓN 1: PAGAR AHORA */}
              <div 
                className="p-4 rounded-2xl border-2 space-y-3 transition-all"
                style={{
                  borderColor: colors.primaryButtonBg,
                  backgroundColor: `${colors.primaryButtonBg}08`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold shadow-xs"
                      style={{
                        backgroundColor: colors.primaryButtonBg,
                        color: colors.primaryButtonText
                      }}
                    >
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black" style={{ color: colors.titleText }}>
                        1. Pagar Ahora
                      </h4>
                      <p className="text-[11px] text-slate-500">Pago Móvil / Transferencia en el acto</p>
                    </div>
                  </div>
                  <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${colors.primaryButtonBg}20`,
                      color: colors.primaryButtonBg
                    }}
                  >
                    Sin deudas
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-line relative">
                  {settings.paymentInfo}
                  <button
                    type="button"
                    onClick={handleCopyBankInfo}
                    className="absolute top-2 right-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 font-sans"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedBankInfo ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinalSubmit('pagar_ahora')}
                  style={{
                    backgroundColor: colors.primaryButtonBg,
                    color: colors.primaryButtonText
                  }}
                  className="w-full py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all hover:opacity-90 active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? 'Procesando...' : `Confirmar y Pagar Ahora (${formatMoney(cartSummary.totalPrice, settings.currency)})`}
                </button>
              </div>

              {/* OPCIÓN 2: PAGAR PARA EL 15 (CON COLOR SECUNDARIO) */}
              <div 
                className="p-4 rounded-2xl border-2 space-y-3 transition-all"
                style={{
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.cardBackground
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold shadow-xs"
                      style={{
                        backgroundColor: colors.secondaryButtonBg,
                        color: colors.secondaryButtonText
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black" style={{ color: colors.titleText }}>
                        2. Pagar para el 15
                      </h4>
                      <p className="text-[11px] text-slate-500">Corte Quincenal / Fiado de Confianza</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    Quincena
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Se acumula en tu cuenta del kiosco y pagas el saldo total el día 15 cuando se haga el corte de cuentas.
                </p>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinalSubmit('pagar_quincena')}
                  style={{
                    backgroundColor: colors.secondaryButtonBg,
                    color: colors.secondaryButtonText
                  }}
                  className="w-full py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all hover:opacity-90 active:scale-98"
                >
                  <Calendar className="w-4 h-4" />
                  {isSubmitting ? 'Procesando...' : 'Anotar a mi Cuenta (Pagar el 15)'}
                </button>
              </div>

            </div>

            <button
              type="button"
              onClick={() => setShowPaymentChoiceModal(false)}
              className="w-full py-2 text-xs text-slate-500 font-semibold hover:text-slate-800"
            >
              Regresar y modificar pedido
            </button>

          </div>
        </div>
      )}

    </div>
  );
};
