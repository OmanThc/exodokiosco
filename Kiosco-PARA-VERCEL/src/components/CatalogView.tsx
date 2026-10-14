import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Check, X, Tag, Package, DollarSign, 
  Sparkles, Image as ImageIcon, Upload, Snowflake, Boxes, ArrowRightLeft, 
  AlertTriangle, RefreshCw
} from 'lucide-react';
import { CatalogProduct, ThemeColorId } from '../types';
import { formatMoney } from '../utils/format';
import { getTheme } from '../utils/theme';

interface CatalogViewProps {
  products: CatalogProduct[];
  currency: string;
  themeId?: ThemeColorId;
  onSaveProducts: (products: CatalogProduct[]) => Promise<void>;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  currency,
  themeId,
  onSaveProducts
}) => {
  const theme = getTheme(themeId);
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'inventory'>('catalog');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [promo, setPromo] = useState('');
  const [categoria, setCategoria] = useState('Bebidas');
  const [emoji, setEmoji] = useState('🧃');
  const [imagenUrl, setImagenUrl] = useState('');
  const [stockNevera, setStockNevera] = useState('12');
  const [stockDeposito, setStockDeposito] = useState('24');

  const popularEmojis = ['🧃', '🥤', '🍬', '⚡', '🍑', '💧', '☕', '🍫', '🍪', '🥔', '🥪', '🥜', '🍿', '🍦'];
  const categoriesList = ['Bebidas', 'Dulces', 'Snacks', 'Comida', 'Varios'];

  const resetForm = () => {
    setNombre('');
    setPrecio('');
    setPromo('');
    setCategoria('Bebidas');
    setEmoji('🧃');
    setImagenUrl('');
    setStockNevera('12');
    setStockDeposito('24');
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleStartEdit = (product: CatalogProduct) => {
    setEditingId(product.id);
    setNombre(product.nombre);
    setPrecio(String(product.precio));
    setPromo(product.promo || '');
    setCategoria(product.categoria || 'Varios');
    setEmoji(product.emoji || '📦');
    setImagenUrl(product.imagenUrl || '');
    setStockNevera(String(product.stockNevera ?? 10));
    setStockDeposito(String(product.stockDeposito ?? 20));
    setShowAddForm(true);
    setActiveSubTab('catalog');
  };

  // Image file upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImagenUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !precio) return;

    const priceNum = Math.round((parseFloat(precio) || 0) * 100) / 100;
    const sNevera = Math.max(0, parseInt(stockNevera, 10) || 0);
    const sDeposito = Math.max(0, parseInt(stockDeposito, 10) || 0);

    let updatedList: CatalogProduct[];
    if (editingId) {
      updatedList = products.map(p =>
        p.id === editingId
          ? { 
              ...p, 
              nombre: nombre.trim(), 
              precio: priceNum, 
              promo: promo.trim() || undefined, 
              categoria, 
              emoji,
              imagenUrl: imagenUrl || undefined,
              stockNevera: sNevera,
              stockDeposito: sDeposito,
              stock: sNevera + sDeposito
            }
          : p
      );
    } else {
      const newProd: CatalogProduct = {
        id: 'prod-' + Date.now(),
        nombre: nombre.trim(),
        precio: priceNum,
        promo: promo.trim() || undefined,
        categoria,
        emoji,
        imagenUrl: imagenUrl || undefined,
        stockNevera: sNevera,
        stockDeposito: sDeposito,
        stock: sNevera + sDeposito
      };
      updatedList = [...products, newProd];
    }

    await onSaveProducts(updatedList);
    resetForm();
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar "${name}" del catálogo?`)) {
      const updatedList = products.filter(p => p.id !== id);
      await onSaveProducts(updatedList);
    }
  };

  // Quick adjust inventory
  const handleQuickAdjustStock = async (
    productId: string,
    field: 'stockNevera' | 'stockDeposito',
    delta: number
  ) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        const current = p[field] ?? 0;
        const nextVal = Math.max(0, current + delta);
        const nextNevera = field === 'stockNevera' ? nextVal : (p.stockNevera ?? 0);
        const nextDeposito = field === 'stockDeposito' ? nextVal : (p.stockDeposito ?? 0);
        return {
          ...p,
          [field]: nextVal,
          stock: nextNevera + nextDeposito
        };
      }
      return p;
    });
    await onSaveProducts(updated);
  };

  // Direct edit inventory field
  const handleDirectInventoryChange = async (
    productId: string,
    field: 'stockNevera' | 'stockDeposito',
    valueStr: string
  ) => {
    const val = Math.max(0, parseInt(valueStr, 10) || 0);
    const updated = products.map(p => {
      if (p.id === productId) {
        const nextNevera = field === 'stockNevera' ? val : (p.stockNevera ?? 0);
        const nextDeposito = field === 'stockDeposito' ? val : (p.stockDeposito ?? 0);
        return {
          ...p,
          [field]: val,
          stock: nextNevera + nextDeposito
        };
      }
      return p;
    });
    await onSaveProducts(updated);
  };

  // Transfer from warehouse/depósito into nevera
  const handleRestockNevera = async (productId: string, count: number = 6) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const availableInDepo = prod.stockDeposito ?? 0;
    if (availableInDepo <= 0) {
      alert(`No hay unidades en el almacén de ${prod.nombre} para transferir a la nevera.`);
      return;
    }

    const moveCount = Math.min(count, availableInDepo);
    const updated = products.map(p => {
      if (p.id === productId) {
        const nextNevera = (p.stockNevera ?? 0) + moveCount;
        const nextDeposito = (p.stockDeposito ?? 0) - moveCount;
        return {
          ...p,
          stockNevera: nextNevera,
          stockDeposito: nextDeposito,
          stock: nextNevera + nextDeposito
        };
      }
      return p;
    });
    await onSaveProducts(updated);
  };

  // Inventory Totals
  const totalInNevera = products.reduce((sum, p) => sum + (p.stockNevera ?? 0), 0);
  const totalInDeposito = products.reduce((sum, p) => sum + (p.stockDeposito ?? 0), 0);
  const totalDisponible = totalInNevera + totalInDeposito;

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider ${theme.primaryDarkText} ${theme.primaryLightBg} px-2.5 py-1 rounded-full`}>
            Catálogo & Control de Stock
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            Productos, Fotos e Inventario
          </h2>
          <p className="text-xs text-slate-500">
            Administra tus productos, agrega fotos reales y monitorea qué hay dentro de la nevera vs almacén.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!showAddForm && (
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className={`px-4 py-2.5 ${theme.primaryBg} ${theme.primaryHover} text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors`}
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs: Catálogo vs Inventario de Nevera */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('catalog')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeSubTab === 'catalog'
              ? `${theme.primaryBg} text-white shadow-xs`
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Ver Catálogo y Fotos ({products.length})
        </button>

        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeSubTab === 'inventory'
              ? `${theme.primaryBg} text-white shadow-xs`
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Snowflake className="w-4 h-4 text-cyan-600" />
          Inventario Nevera & Depósito ({totalDisponible} uds)
        </button>
      </div>

      {/* ADD / EDIT FORM */}
      {showAddForm && (
        <form onSubmit={handleSaveProduct} className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-emerald-500 shadow-lg space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Editar Producto & Foto' : 'Agregar Nuevo Producto'}
              </h3>
              <p className="text-xs text-slate-500">
                Configura el nombre, precio, foto del producto y stock de inicio.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Foto del Producto (Upload o URL) */}
            <div className="sm:col-span-1 space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                Foto del Producto:
              </label>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-emerald-400 transition-colors bg-slate-50 relative group flex flex-col items-center justify-center min-h-[140px]">
                {imagenUrl ? (
                  <div className="relative group w-full flex flex-col items-center">
                    <img
                      src={imagenUrl}
                      alt="Vista previa"
                      className="w-24 h-24 object-cover rounded-xl shadow-md border border-white"
                    />
                    <button
                      type="button"
                      onClick={() => setImagenUrl('')}
                      className="mt-2 text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Quitar foto
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-slate-400 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700 block">Subir foto desde tu dispositivo</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">JPG, PNG o WEBP (máx 5MB)</span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Seleccionar foto para el producto"
                />
              </div>

              {/* Or paste URL */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">O ingresa un enlace web de imagen:</span>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/foto.jpg"
                  value={imagenUrl.startsWith('data:') ? '' : imagenUrl}
                  onChange={(e) => setImagenUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none"
                />
              </div>
            </div>

            {/* Datos Principales */}
            <div className="sm:col-span-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nombre */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nombre del Producto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FRUTON, MALTA, GLU BOMBITA..."
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none font-bold"
                  />
                </div>

                {/* Precio Unitario */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Precio Unitario ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.80"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none font-black text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Promoción opcional */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Promoción / Oferta (Opcional):</label>
                  <input
                    type="text"
                    placeholder="Ej: 2 por 1$, Promo Quincena..."
                    value={promo}
                    onChange={(e) => setPromo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none font-medium"
                  />
                </div>

                {/* Categoría */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Categoría:</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none font-medium"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* INVENTARIO INICIAL */}
              <div className="p-3.5 bg-cyan-50/50 rounded-2xl border border-cyan-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-900">
                  <Snowflake className="w-4 h-4 text-cyan-600" />
                  Inventario Inicial:
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">🧊 Dentro de la Nevera:</label>
                    <input
                      type="number"
                      min="0"
                      value={stockNevera}
                      onChange={(e) => setStockNevera(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-cyan-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">📦 En Depósito / Almacén:</label>
                    <input
                      type="number"
                      min="0"
                      value={stockDeposito}
                      onChange={(e) => setStockDeposito(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Emoji Selector de Respaldo */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Ícono Emoji (si no hay foto):</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {popularEmojis.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setEmoji(emo)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all ${
                        emoji === emo ? 'bg-emerald-100 ring-2 ring-emerald-500 scale-110' : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2 ${theme.primaryBg} ${theme.primaryHover} text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5`}
            >
              <Check className="w-4 h-4" />
              Guardar Producto
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 1: VISTA DE CATÁLOGO CON FOTOS */}
      {activeSubTab === 'catalog' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const nevera = p.stockNevera ?? 0;
            const depo = p.stockDeposito ?? 0;
            const total = nevera + depo;
            const isOutOfStockNevera = nevera <= 0;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Imagen del producto o Emoji */}
                <div className="relative bg-slate-50 h-40 flex items-center justify-center overflow-hidden border-b border-slate-100">
                  {p.imagenUrl ? (
                    <img
                      src={p.imagenUrl}
                      alt={p.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="text-5xl select-none">{p.emoji || '📦'}</div>
                  )}

                  {/* Badges superiores */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                    <span className="text-[10px] font-bold bg-white/95 backdrop-blur-xs text-slate-700 px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                      {p.categoria}
                    </span>
                    {p.promo && (
                      <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                        {p.promo}
                      </span>
                    )}
                  </div>

                  {/* Estado de Nevera */}
                  <div className="absolute bottom-2.5 right-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 ${
                        isOutOfStockNevera
                          ? 'bg-rose-600 text-white'
                          : nevera <= 3
                          ? 'bg-amber-500 text-white'
                          : 'bg-cyan-600 text-white'
                      }`}
                    >
                      <Snowflake className="w-3 h-3" />
                      {nevera} en nevera
                    </span>
                  </div>
                </div>

                {/* Info Card */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 leading-tight">
                      {p.nombre}
                    </h4>
                    <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                      <span>Almacén: {depo} uds</span>
                      <span>Total: {total} uds</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-base font-black text-emerald-700">
                      {formatMoney(p.precio, currency)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(p)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar producto o foto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.nombre)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: CONTROL DE INVENTARIO (NEVERA VS ALMACÉN) */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          
          {/* KPI Resumen de Inventario */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-cyan-50 to-white p-4 rounded-2xl border border-cyan-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-cyan-800 flex items-center gap-1.5">
                <Snowflake className="w-4 h-4 text-cyan-600" />
                Dentro de la Nevera
              </span>
              <p className="text-3xl font-black text-cyan-900">{totalInNevera}</p>
              <span className="text-[11px] text-cyan-700">Unidades frías listas para consumo</span>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-slate-600" />
                En Depósito / Almacén
              </span>
              <p className="text-3xl font-black text-slate-900">{totalInDeposito}</p>
              <span className="text-[11px] text-slate-500">Unidades de reserva guardadas</span>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                Total Disponible
              </span>
              <p className="text-3xl font-black text-emerald-700">{totalDisponible}</p>
              <span className="text-[11px] text-emerald-700">Inventario general completo</span>
            </div>
          </div>

          {/* Tabla de Inventario Modificable */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Control de Existencias por Producto</h3>
                <p className="text-xs text-slate-500">Modifica las cantidades directamente o usa los botones de ajuste rápido.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {products.map((p) => {
                const sNevera = p.stockNevera ?? 0;
                const sDepo = p.stockDeposito ?? 0;
                const total = sNevera + sDepo;
                const isNeveraLow = sNevera <= 3 && sNevera > 0;
                const isNeveraEmpty = sNevera === 0;

                return (
                  <div key={p.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    
                    {/* Producto info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      {p.imagenUrl ? (
                        <img src={p.imagenUrl} alt={p.nombre} className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-xs" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                          {p.emoji || '📦'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{p.nombre}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-emerald-700">{formatMoney(p.precio, currency)}</span>
                          <span>•</span>
                          <span className="uppercase text-[10px]">{p.categoria}</span>
                        </div>
                      </div>
                    </div>

                    {/* Controles: En Nevera */}
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
                          <span className="text-xs font-bold text-slate-700">En Nevera:</span>
                          {isNeveraEmpty && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded-md">
                              ¡Agotado!
                            </span>
                          )}
                          {isNeveraLow && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-md">
                              ¡Poco stock!
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjustStock(p.id, 'stockNevera', -1)}
                            className="w-7 h-7 bg-white hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-xs shadow-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={sNevera}
                            onChange={(e) => handleDirectInventoryChange(p.id, 'stockNevera', e.target.value)}
                            className="w-14 text-center text-xs font-black bg-white rounded-lg py-1 border border-slate-200 outline-none text-cyan-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickAdjustStock(p.id, 'stockNevera', 1)}
                            className="w-7 h-7 bg-white hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-xs shadow-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Controles: En Almacén / Depósito */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs font-bold text-slate-700">En Depósito:</span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjustStock(p.id, 'stockDeposito', -1)}
                            className="w-7 h-7 bg-white hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-xs shadow-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={sDepo}
                            onChange={(e) => handleDirectInventoryChange(p.id, 'stockDeposito', e.target.value)}
                            className="w-14 text-center text-xs font-black bg-white rounded-lg py-1 border border-slate-200 outline-none text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickAdjustStock(p.id, 'stockDeposito', 1)}
                            className="w-7 h-7 bg-white hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-xs shadow-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Total & Reabastecer Nevera */}
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[11px] text-slate-400 font-bold uppercase">
                          Total: <strong className="text-slate-900 text-sm font-black">{total}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRestockNevera(p.id, 6)}
                          disabled={sDepo <= 0}
                          className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 disabled:opacity-40 text-cyan-800 rounded-xl text-xs font-bold border border-cyan-200 flex items-center gap-1 transition-all"
                          title="Pasar unidades del almacén hacia la nevera"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          Reabastecer Nevera (+6)
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
};
