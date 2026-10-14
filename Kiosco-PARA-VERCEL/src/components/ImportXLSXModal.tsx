import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertCircle, 
  X, Users, DollarSign, Package, ArrowRight, RefreshCw, FileText,
  Clock, ShieldAlert, Sparkles, Filter, Check, Eye, History, Trash2, RotateCcw, Pencil, Plus
} from 'lucide-react';
import { OrderRecord, PaymentRecord, ImportBatchMeta } from '../types';
import { formatMoney } from '../utils/format';
import { 
  parseXLSXFile, downloadSampleExcelTemplate, ParsedImportData, recomputeImportSummary 
} from '../utils/excelImport';
import { importXLSXData, fetchImportBatches, undoImportBatch } from '../services/api';

interface ImportXLSXModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  onImportSuccess: (orders: OrderRecord[], payments: PaymentRecord[]) => void;
}

export const ImportXLSXModal: React.FC<ImportXLSXModalProps> = ({
  isOpen,
  onClose,
  currency,
  onImportSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ParsedImportData | null>(null);
  const [replaceMode, setReplaceMode] = useState(false); // false: merge, true: replace
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'buyers' | 'orders' | 'payments'>('buyers');
  const [searchPreview, setSearchPreview] = useState('');

  // Datos EDITABLES de la vista previa: el administrador puede corregir,
  // borrar o agregar pedidos y abonos ANTES de confirmar la importación.
  const [draftOrders, setDraftOrders] = useState<OrderRecord[]>([]);
  const [draftPayments, setDraftPayments] = useState<PaymentRecord[]>([]);

  // Importaciones anteriores (para poder deshacer)
  const [batches, setBatches] = useState<ImportBatchMeta[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  // Confirmación para elegir qué quitar (pedidos y/o abonos)
  const [pendingUndo, setPendingUndo] = useState<ImportBatchMeta | null>(null);
  const [undoRemoveOrders, setUndoRemoveOrders] = useState(true);
  const [undoRemovePayments, setUndoRemovePayments] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const list = await fetchImportBatches();
      setBatches(list);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // Abre la confirmación para elegir qué datos quitar
  const openUndoConfirm = (batch: ImportBatchMeta) => {
    setPendingUndo(batch);
    setUndoRemoveOrders(batch.ordersAdded > 0);
    setUndoRemovePayments(batch.paymentsAdded > 0);
    setUndoMsg(null);
    setUndoError(null);
  };

  const cancelUndo = () => setPendingUndo(null);

  const confirmUndo = async () => {
    if (!pendingUndo) return;
    if (!undoRemoveOrders && !undoRemovePayments) return;

    setUndoingId(pendingUndo.id);
    setUndoMsg(null);
    setUndoError(null);

    try {
      const res = await undoImportBatch(pendingUndo.id, {
        removeOrders: undoRemoveOrders,
        removePayments: undoRemovePayments
      });

      if (res.success) {
        setUndoMsg(res.message || 'Datos quitados correctamente.');
        if (res.orders && res.payments) {
          onImportSuccess(res.orders, res.payments);
        }
        if (res.imports) {
          setBatches(res.imports);
        } else {
          await loadBatches();
        }
        setPendingUndo(null);
      } else {
        setUndoError(res.message || 'No se pudo deshacer la importación.');
      }
    } catch (err: any) {
      setUndoError(err.message || 'Error de comunicación al deshacer la importación.');
    } finally {
      setUndoingId(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setUndoMsg(null);
      setUndoError(null);
      setPendingUndo(null);
      loadBatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Resumen recalculado en vivo a partir de los datos editados
  const draftPreview = useMemo(() => {
    if (!previewData) return null;
    return recomputeImportSummary(
      draftOrders,
      draftPayments,
      previewData.stats.sheetsFound,
      previewData.warnings
    );
  }, [draftOrders, draftPayments, previewData]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.xlsx') && !selectedFile.name.toLowerCase().endsWith('.xls')) {
      setErrorMsg('Por favor selecciona un archivo con formato Excel (.xlsx o .xls)');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const parsed = await parseXLSXFile(buffer);
      setPreviewData(parsed);
      setDraftOrders(parsed.orders.map(o => ({ ...o })));
      setDraftPayments(parsed.payments.map(p => ({ ...p })));
      if (parsed.warnings.length > 0) {
        setErrorMsg(parsed.warnings.join(' '));
      }
    } catch (err: any) {
      console.error('Error parsing XLSX:', err);
      setErrorMsg(err.message || 'Error al procesar el archivo Excel. Verifica el formato de las columnas.');
      setPreviewData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    if (draftOrders.length === 0 && draftPayments.length === 0) {
      setErrorMsg('No hay datos para importar. Edita o agrega al menos un pedido o abono.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await importXLSXData({
        orders: draftOrders,
        payments: draftPayments,
        replaceMode,
        fileName: file?.name
      });

      if (res.success && res.orders) {
        setSaveSuccess(true);
        onImportSuccess(res.orders, res.payments || []);
        if (res.imports) setBatches(res.imports);
        setTimeout(() => {
          setSaveSuccess(false);
          handleClose();
        }, 1500);
      } else {
        setErrorMsg(res.message || 'Error al guardar los registros en el sistema.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de comunicación al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData(null);
    setDraftOrders([]);
    setDraftPayments([]);
    setErrorMsg(null);
    setSaveSuccess(false);
    onClose();
  };

  // ----- Edición de la vista previa (antes de importar) -----
  const updateDraftOrder = (idx: number, patch: Partial<OrderRecord>) => {
    setDraftOrders(prev => prev.map((o, i) => {
      if (i !== idx) return o;
      const updated = { ...o, ...patch };
      // Mantener los "items" sincronizados con el producto/monto cuando hay uno solo
      if (!Array.isArray(updated.items) || updated.items.length <= 1) {
        updated.items = [{
          nombre: updated.producto || 'Consumo',
          cantidad: updated.cantidad || 1,
          precio: updated.cantidad && updated.cantidad > 0
            ? Math.round(((updated.monto || 0) / updated.cantidad) * 100) / 100
            : (updated.monto || 0)
        }];
      }
      return updated;
    }));
  };

  const removeDraftOrder = (idx: number) => {
    setDraftOrders(prev => prev.filter((_, i) => i !== idx));
  };

  const addDraftOrder = () => {
    setDraftOrders(prev => [...prev, {
      id: 'ord-new-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      fecha: new Date().toISOString(),
      nombre: '',
      telefono: '',
      producto: '',
      cantidad: 1,
      items: [{ nombre: '', cantidad: 1, precio: 0 }],
      monto: 0,
      notas: '',
      estadoPago: 'pendiente',
      syncStatus: 'local',
      syncMessage: 'Agregado manualmente al revisar el archivo'
    }]);
  };

  const updateDraftPayment = (idx: number, patch: Partial<PaymentRecord>) => {
    setDraftPayments(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removeDraftPayment = (idx: number) => {
    setDraftPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const addDraftPayment = () => {
    setDraftPayments(prev => [...prev, {
      id: 'pay-new-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      fecha: new Date().toISOString(),
      nombre: '',
      monto: 0,
      metodo: 'Efectivo',
      nota: ''
    }]);
  };

  const filteredPreviewBuyers = previewData?.buyersSummary.filter(b => 
    b.nombre.toLowerCase().includes(searchPreview.toLowerCase()) ||
    b.telefono.includes(searchPreview) ||
    b.productos.some(p => p.toLowerCase().includes(searchPreview.toLowerCase()))
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black flex items-center gap-2">
                Importar Datos desde Archivo Excel (.XLSX)
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Carga Masiva Automática
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Sube tu archivo y se detectarán compradores, teléfonos, deudas, productos y abonos.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Step 1: Upload or Download Template */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Upload Box */}
            <div className="md:col-span-2 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center relative cursor-pointer group">
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 mb-1">
                {file ? file.name : 'Haz clic o arrastra tu archivo .XLSX aquí'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-3">
                {file 
                  ? `Tamaño: ${(file.size / 1024).toFixed(1)} KB • Procesado y listo para revisar`
                  : 'Acepta archivos exportados de esta app o cualquier tabla con columnas de Comprador, Teléfono, Deuda, Abono y Productos.'
                }
              </p>
              <button 
                type="button"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs pointer-events-none"
              >
                {file ? 'Cambiar Archivo' : 'Seleccionar Archivo Excel'}
              </button>
            </div>

            {/* Template Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  ¿No tienes un formato?
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Descarga nuestra plantilla oficial con las columnas ya listas para llenar tus ventas, deudas y abonos.
                </p>
              </div>

              <button
                type="button"
                onClick={downloadSampleExcelTemplate}
                className="mt-4 w-full py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Descargar Plantilla (.XLSX)
              </button>
            </div>
          </div>

          {/* Loading status */}
          {isProcessing && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Analizando hojas, compradores y abonos del archivo...</p>
            </div>
          )}

          {/* Error / Warning Alert */}
          {errorMsg && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aviso del análisis</p>
                <p className="text-amber-800 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Deshacer importaciones anteriores */}
          {batches.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <History className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="text-xs font-black text-slate-800">Importaciones anteriores</span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    — ¿Te equivocaste con un archivo? Puedes deshacerlo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => batches[0] && openUndoConfirm(batches[0])}
                    disabled={isLoadingBatches || (!!batches[0] && undoingId === batches[0].id)}
                    title="Quitar los datos que agregó la última importación"
                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Deshacer la última
                  </button>
                  <button
                    type="button"
                    onClick={loadBatches}
                    disabled={isLoadingBatches}
                    title="Actualizar lista"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBatches ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {batches.map(b => (
                  <div key={b.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {b.fileName || 'Archivo importado'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(b.fecha).toLocaleString()} • {b.ordersAdded} pedido(s) • {b.paymentsAdded} abono(s)
                        {b.replaceMode && (
                          <span className="ml-1.5 text-rose-600 font-semibold">(reemplazó todo)</span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openUndoConfirm(b)}
                      disabled={undoingId === b.id}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Eliminar los datos que agregó esta importación"
                    >
                      {undoingId === b.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Quitar datos
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensajes de deshacer importación */}
          {undoMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-semibold">{undoMsg}</p>
            </div>
          )}
          {undoError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-semibold">{undoError}</p>
            </div>
          )}

          {/* Preview Section if data is ready */}
          {previewData && draftPreview && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Compradores Únicos</span>
                  <p className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    {draftPreview.stats.totalUniqueBuyers}
                  </p>
                </div>
                
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Consumido</span>
                  <p className="text-lg font-black text-slate-900">
                    {formatMoney(draftPreview.stats.totalMonto, currency)}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Pagado / Abonado</span>
                  <p className="text-lg font-black text-emerald-600">
                    {formatMoney(draftPreview.stats.totalAbonado, currency)}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Por Cobrar (Deuda)</span>
                  <p className="text-lg font-black text-rose-600">
                    {formatMoney(draftPreview.stats.totalDeuda, currency)}
                  </p>
                </div>
              </div>

              {/* Import Options (Merge vs Replace) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">Modo de Carga en la Base de Datos:</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {replaceMode 
                      ? '⚠️ Reemplazar: Se sustituirán los registros existentes por los del archivo Excel.' 
                      : '✅ Combinar (Recomendado): Se agregarán los nuevos clientes y pedidos sin borrar lo que ya tienes.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReplaceMode(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !replaceMode ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Combinar
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaceMode(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      replaceMode ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Reemplazar Todo
                  </button>
                </div>
              </div>

              {/* Sub-Tabs for Preview Table */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveTab('buyers')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'buyers'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Resumen por Comprador ({draftPreview.buyersSummary.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'orders'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    Pedidos / Consumos ({draftOrders.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('payments')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'payments'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Abonos Detectados ({draftPayments.length})
                  </button>
                </div>

                <div className="text-[11px] text-slate-500">
                  Hojas detectadas: <span className="font-semibold text-slate-700">{previewData.stats.sheetsFound.join(', ') || '—'}</span>
                </div>
              </div>

              {/* Aviso de edición */}
              {(activeTab === 'orders' || activeTab === 'payments') && (
                <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-2xl text-[11px] flex items-start gap-2">
                  <Pencil className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <p>
                    Puedes <strong>modificar cualquier dato</strong> antes de importar: escribe sobre las casillas para
                    cambiar el comprador, el producto, la cantidad, el precio o el monto; usa el ícono
                    <Trash2 className="inline w-3 h-3 mx-1" /> para borrar una fila o
                    <Plus className="inline w-3 h-3 mx-1" /> para agregar una nueva.
                  </p>
                </div>
              )}

              {/* Tab 1: Buyers summary */}
              {activeTab === 'buyers' && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Comprador</th>
                          <th className="py-2.5 px-3">Teléfono</th>
                          <th className="py-2.5 px-3">Lo que se llevó (Productos)</th>
                          <th className="py-2.5 px-3">Total Consumido</th>
                          <th className="py-2.5 px-3">¿Abonó / Pagó?</th>
                          <th className="py-2.5 px-3">Lo Que Debe</th>
                          <th className="py-2.5 px-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {draftPreview.buyersSummary.map((b, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {b.nombre}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                              {b.telefono || '-'}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs truncate" title={b.productos.join(', ')}>
                              <span className="font-medium text-slate-800">
                                {b.productos.join(', ') || `${b.totalProductos} producto(s)`}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({b.totalProductos} uds)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {formatMoney(b.totalMonto, currency)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">
                              {b.totalAbonado > 0 ? formatMoney(b.totalAbonado, currency) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-black text-rose-600">
                              {b.saldoDebe > 0 ? formatMoney(b.saldoDebe, currency) : '$0.00'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.saldoDebe <= 0 && b.totalAbonado > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {b.saldoDebe <= 0 && b.totalAbonado > 0 ? 'AL DÍA' : 'DEBE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Orders list (EDITABLE) */}
              {activeTab === 'orders' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Pedidos / Consumos ({draftOrders.length})
                    </p>
                    <button
                      type="button"
                      onClick={addDraftOrder}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Agregar pedido
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="max-h-72 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[760px]">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-2">Comprador</th>
                            <th className="py-2.5 px-2">Teléfono</th>
                            <th className="py-2.5 px-2">Producto(s)</th>
                            <th className="py-2.5 px-2 w-16">Cant</th>
                            <th className="py-2.5 px-2 w-24">Monto</th>
                            <th className="py-2.5 px-2">Estado</th>
                            <th className="py-2.5 px-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {draftOrders.map((o, idx) => (
                            <tr key={o.id || idx} className="hover:bg-slate-50/70 align-top">
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={o.nombre}
                                  placeholder="Comprador"
                                  onChange={(e) => updateDraftOrder(idx, { nombre: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={o.telefono}
                                  placeholder="Teléfono"
                                  onChange={(e) => updateDraftOrder(idx, { telefono: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={o.producto}
                                  placeholder="Producto(s)"
                                  onChange={(e) => updateDraftOrder(idx, { producto: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={o.cantidad}
                                  onChange={(e) => updateDraftOrder(idx, { cantidad: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={o.monto}
                                  onChange={(e) => updateDraftOrder(idx, { monto: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <select
                                  value={o.estadoPago}
                                  onChange={(e) => updateDraftOrder(idx, { estadoPago: e.target.value as 'pendiente' | 'pagado' })}
                                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border outline-hidden ${
                                    o.estadoPago === 'pagado'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                      : 'bg-rose-50 border-rose-200 text-rose-800'
                                  }`}
                                >
                                  <option value="pendiente">Pendiente</option>
                                  <option value="pagado">Pagado</option>
                                </select>
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeDraftOrder(idx)}
                                  title="Borrar este pedido de la importación"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {draftOrders.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-6 px-3 text-center text-slate-400 text-xs">
                                No hay pedidos. Usa "Agregar pedido" si necesitas uno.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Payments list (EDITABLE) */}
              {activeTab === 'payments' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Abonos / Pagos ({draftPayments.length})
                    </p>
                    <button
                      type="button"
                      onClick={addDraftPayment}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Agregar abono
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="max-h-72 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[640px]">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-2">Cliente</th>
                            <th className="py-2.5 px-2 w-28">Monto</th>
                            <th className="py-2.5 px-2">Método</th>
                            <th className="py-2.5 px-2">Nota</th>
                            <th className="py-2.5 px-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {draftPayments.map((p, idx) => (
                            <tr key={p.id || idx} className="hover:bg-slate-50/70">
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={p.nombre}
                                  placeholder="Cliente"
                                  onChange={(e) => updateDraftPayment(idx, { nombre: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={p.monto}
                                  onChange={(e) => updateDraftPayment(idx, { monto: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right text-emerald-700 font-bold focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={p.metodo}
                                  placeholder="Efectivo, Pago Móvil..."
                                  onChange={(e) => updateDraftPayment(idx, { metodo: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={p.nota || ''}
                                  placeholder="Nota (opcional)"
                                  onChange={(e) => updateDraftPayment(idx, { nota: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeDraftPayment(idx)}
                                  title="Borrar este abono de la importación"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {draftPayments.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-6 px-3 text-center text-slate-400 text-xs">
                                No hay abonos. Usa "Agregar abono" si necesitas uno.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {previewData 
              ? `Se cargarán ${draftOrders.length} pedidos y ${draftPayments.length} abonos a tu sistema.`
              : 'Selecciona o arrastra tu archivo Excel arriba para previsualizar los datos.'
            }
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {previewData && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || saveSuccess}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    ¡Datos Importados Correctamente!
                  </>
                ) : isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando en el Sistema...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Confirmar y Cargar Todo Automáticamente
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Confirmación: elegir qué quitar (pedidos y/o abonos) */}
      {pendingUndo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900">Quitar datos de la importación</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archivo: <span className="font-semibold text-slate-700">{pendingUndo.fileName || 'importado'}</span>
                </p>
                {pendingUndo.replaceMode && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    Esta importación reemplazó todo: al quitar, se restaurará la información anterior.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold ${
                pendingUndo.ordersAdded === 0
                  ? 'border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-800 cursor-pointer hover:bg-slate-50'
              }`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-rose-600"
                  checked={undoRemoveOrders}
                  disabled={pendingUndo.ordersAdded === 0}
                  onChange={(e) => setUndoRemoveOrders(e.target.checked)}
                />
                Quitar pedidos / consumos ({pendingUndo.ordersAdded})
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold ${
                pendingUndo.paymentsAdded === 0
                  ? 'border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-800 cursor-pointer hover:bg-slate-50'
              }`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-rose-600"
                  checked={undoRemovePayments}
                  disabled={pendingUndo.paymentsAdded === 0}
                  onChange={(e) => setUndoRemovePayments(e.target.checked)}
                />
                Quitar abonos / pagos ({pendingUndo.paymentsAdded})
              </label>

              {!undoRemoveOrders && !undoRemovePayments && (
                <p className="text-[11px] text-rose-600 font-semibold">Selecciona al menos una opción.</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelUndo}
                disabled={!!undoingId}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmUndo}
                disabled={!!undoingId || (!undoRemoveOrders && !undoRemovePayments)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {undoingId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Quitando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar seleccionado
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
