import React, { useState } from 'react';
import { 
  Save, FileSpreadsheet, Lock, Store, 
  CreditCard, CheckCircle2, Play, RefreshCw, AlertCircle, Radio,
  Image as ImageIcon, Upload, Trash2, Palette, Sparkles, Sliders,
  RotateCcw, Check, Copy, Layers, Tag, MousePointer, ShieldCheck
} from 'lucide-react';
import { AppSettings, CustomThemeColors, ThemeColorId } from '../types';
import { testGoogleSheetsConnection } from '../services/api';
import { 
  COLOR_PRESETS, DEFAULT_CUSTOM_COLORS, getEffectiveCustomColors, 
  sanitizeHex, toColorPickerHex 
} from '../utils/theme';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onOpenGoogleSheetGuide: () => void;
  onOpenNfcGuide: () => void;
  onOpenResetData?: () => void;
}

interface ColorFieldDef {
  key: keyof CustomThemeColors;
  label: string;
  description: string;
  sampleText?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onOpenGoogleSheetGuide,
  onOpenNfcGuide,
  onOpenResetData
}) => {
  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
    customColors: getEffectiveCustomColors(settings.customColors)
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const colors = getEffectiveCustomColors(formData.customColors);

  const handleTest = async () => {
    if (!formData.scriptUrl) {
      setTestResult({ success: false, message: 'Ingresa una URL de Google Apps Script primero.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGoogleSheetsConnection(formData.scriptUrl);
      setTestResult({ success: res.success, message: res.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error de conexión' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('El logo no debe superar los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setFormData(prev => ({ ...prev, logoUrl: event.target?.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Update specific color by key
  const updateColorKey = (key: keyof CustomThemeColors, value: string) => {
    setFormData(prev => ({
      ...prev,
      customColors: {
        ...getEffectiveCustomColors(prev.customColors),
        [key]: value
      }
    }));
  };

  // Copy hex code to clipboard
  const handleCopyHex = (key: string, hexValue: string) => {
    navigator.clipboard.writeText(hexValue);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Apply a preset
  const applyPreset = (presetColors: CustomThemeColors, themeId?: string) => {
    setFormData(prev => ({
      ...prev,
      themeColor: (themeId as ThemeColorId) || prev.themeColor,
      customColors: { ...presetColors }
    }));
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setFormData(prev => ({
      ...prev,
      themeColor: 'emerald',
      customColors: { ...DEFAULT_CUSTOM_COLORS }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // Grouped color definitions
  const colorCategories: Array<{
    title: string;
    icon: React.ReactNode;
    description: string;
    fields: ColorFieldDef[];
  }> = [
    {
      title: '1. Fondos y Estructura de la Pantalla',
      icon: <Layers className="w-4 h-4 text-emerald-600" />,
      description: 'Define los tonos generales donde descansa toda la interfaz del kiosco',
      fields: [
        {
          key: 'appBackground',
          label: 'Fondo General de la App',
          description: 'Color de fondo de toda la pantalla (ej: #f1f5f9 para claro, #0b0f19 para oscuro)'
        },
        {
          key: 'sectionCardBg',
          label: 'Fondo de Cajas / Pasos',
          description: 'Color de fondo de las secciones principales (Identificación, Selección, etc.)'
        }
      ]
    },
    {
      title: '2. Banner Superior y Encabezado',
      icon: <Store className="w-4 h-4 text-emerald-600" />,
      description: 'Personaliza el encabezado donde aparece el logo y nombre de tu negocio',
      fields: [
        {
          key: 'headerBg',
          label: 'Fondo del Banner / Encabezado',
          description: 'Color principal del banner superior donde va el logo y título'
        },
        {
          key: 'headerText',
          label: 'Texto del Encabezado',
          description: 'Color de las letras del título y subtítulo dentro del banner'
        }
      ]
    },
    {
      title: '3. Tarjetas de Productos y Tipografía',
      icon: <Tag className="w-4 h-4 text-emerald-600" />,
      description: 'Colores para cada producto, sus bordes, nombres y etiquetas de precio',
      fields: [
        {
          key: 'cardBackground',
          label: 'Fondo de Tarjetas de Productos',
          description: 'Color del recuadro individual de cada producto en venta'
        },
        {
          key: 'cardBorder',
          label: 'Bordes de Tarjetas de Productos',
          description: 'Color de las líneas divisorias y bordes de cada producto'
        },
        {
          key: 'titleText',
          label: 'Nombres de Productos y Títulos',
          description: 'Color de texto de los nombres (ej: MALTA, FRUTON, COOL POWER)'
        },
        {
          key: 'priceAccent',
          label: 'Precios y Promociones Destacadas',
          description: 'Color llamativo para resaltar el precio ($1.00, $0.70) y ofertas'
        }
      ]
    },
    {
      title: '4. Botones de Acción y Opciones de Pago',
      icon: <MousePointer className="w-4 h-4 text-emerald-600" />,
      description: 'Configura exactamente qué color lleva cada botón de compra, cantidad y acceso',
      fields: [
        {
          key: 'primaryButtonBg',
          label: 'Botón Principal (Fondo)',
          description: 'Fondo del botón "Continuar con mi Compra" y opción "1. Pagar Ahora"'
        },
        {
          key: 'primaryButtonText',
          label: 'Botón Principal (Texto)',
          description: 'Color de las letras dentro del botón principal'
        },
        {
          key: 'secondaryButtonBg',
          label: 'Botón "Pagar para el 15" (Fondo)',
          description: 'Fondo del botón para anotar la compra a la quincena'
        },
        {
          key: 'secondaryButtonText',
          label: 'Botón "Pagar para el 15" (Texto)',
          description: 'Color de las letras dentro del botón de la quincena'
        },
        {
          key: 'stepperButtonBg',
          label: 'Botones de Cantidad + y - (Fondo)',
          description: 'Color de los botones para sumar o restar unidades de un producto'
        },
        {
          key: 'stepperButtonText',
          label: 'Botones de Cantidad + y - (Icono)',
          description: 'Color del signo más (+) y menos (-) de los botones de cantidad'
        },
        {
          key: 'categoryActiveBg',
          label: 'Botón de Categoría Activa (Fondo)',
          description: 'Color de la pestaña de categoría seleccionada (Todos, Bebidas, Dulces)'
        },
        {
          key: 'categoryActiveText',
          label: 'Botón de Categoría Activa (Texto)',
          description: 'Color del texto de la categoría seleccionada'
        },
        {
          key: 'adminButtonBg',
          label: 'Botón Acceso Administrador (Fondo)',
          description: 'Color del botón para ingresar al panel de administración'
        },
        {
          key: 'adminButtonText',
          label: 'Botón Acceso Administrador (Texto)',
          description: 'Color del texto e icono del botón de acceso de administrador'
        }
      ]
    }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
            Personalización Total
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            Configuración de Colores con Código Exacto (HEX)
          </h2>
          <p className="text-xs text-slate-500">
            Ingresa el código hexadecimal (#RRGGBB) para definir el color exacto de cada fondo, nombre, tarjeta y botón.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          style={{
            backgroundColor: colors.primaryButtonBg,
            color: colors.primaryButtonText
          }}
          className="px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all shrink-0 hover:opacity-90 active:scale-95"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Cambios
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ¡Configuración y colores guardados exitosamente! Los cambios se aplican de inmediato en el Kiosco.
        </div>
      )}

      {/* SECCIÓN 1: CONFIGURADOR GRANULAR DE COLORES EXACTOS */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Paleta de Colores de la Aplicación</h3>
              <p className="text-xs text-slate-500">
                Puedes escribir directamente el código HEX (ej: <span className="font-mono font-bold text-slate-700">#059669</span>, <span className="font-mono font-bold text-slate-700">#1E293B</span>, <span className="font-mono font-bold text-slate-700">#FF5722</span>) o usar el selector visual.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetToDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Valores Iniciales
          </button>
        </div>

        {/* PRESETS RÁPIDOS */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Paletas Rápidas (Haz 1 clic para cargar colores armónicos y luego modifícalos a tu gusto):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.colors, preset.id)}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-400 text-left transition-all bg-white hover:shadow-xs group"
                title={`Aplicar paleta ${preset.name}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-4 h-4 rounded-full shadow-xs border border-white shrink-0"
                    style={{ backgroundColor: preset.colors.primaryButtonBg }}
                  />
                  <span
                    className="w-4 h-4 rounded-full shadow-xs border border-white shrink-0"
                    style={{ backgroundColor: preset.colors.headerBg }}
                  />
                  <span
                    className="w-4 h-4 rounded-full shadow-xs border border-slate-300 shrink-0"
                    style={{ backgroundColor: preset.colors.appBackground }}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-800 block truncate leading-tight group-hover:text-emerald-700">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PREVISUALIZACIÓN EN VIVO (LIVE PREVIEW) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              Vista Previa en Tiempo Real (así se ve exactamente el Kiosco):
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              En Vivo
            </span>
          </div>

          <div
            className="p-5 rounded-3xl border transition-all space-y-4 shadow-inner"
            style={{
              backgroundColor: colors.appBackground,
              borderColor: colors.cardBorder
            }}
          >
            {/* Header Preview */}
            <div
              className="p-4 rounded-2xl shadow-md flex items-center justify-between gap-3 flex-wrap"
              style={{
                backgroundColor: colors.headerBg,
                color: colors.headerText
              }}
            >
              <div className="flex items-center gap-3">
                {formData.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-xs flex items-center justify-center overflow-hidden">
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                    ⚡
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-black" style={{ color: colors.headerText }}>
                    {formData.businessName || 'Kiosco & Frigobar de Confianza'}
                  </h4>
                  <p className="text-[11px] opacity-90" style={{ color: colors.headerText }}>
                    {formData.businessSubtitle || 'Acerca tu celular al NFC y anota tu compra'}
                  </p>
                </div>
              </div>

              {/* Admin Button Preview in Header */}
              <div
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                style={{
                  backgroundColor: colors.adminButtonBg,
                  color: colors.adminButtonText
                }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Acceso Administrador</span>
              </div>
            </div>

            {/* Category Filter Pills Preview */}
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1 rounded-xl text-xs font-bold shadow-xs"
                style={{
                  backgroundColor: colors.categoryActiveBg,
                  color: colors.categoryActiveText
                }}
              >
                Todos (Activo)
              </span>
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white/80 text-slate-600 border border-slate-200">
                Bebidas
              </span>
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white/80 text-slate-600 border border-slate-200">
                Dulces
              </span>
            </div>

            {/* Product Cards and Action Buttons Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Product 1 */}
              <div
                className="p-3.5 rounded-2xl border shadow-xs flex items-center justify-between gap-3 transition-all"
                style={{
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.cardBorder
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                    🥤
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-black truncate" style={{ color: colors.titleText }}>
                      MALTA BIEN FRÍA
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black" style={{ color: colors.priceAccent }}>
                        $1.00
                      </span>
                      <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded-md">
                        15 en nevera
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    style={{
                      backgroundColor: colors.stepperButtonBg,
                      color: colors.stepperButtonText
                    }}
                    className="w-7 h-7 rounded-lg font-bold flex items-center justify-center shadow-xs text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Product 2 */}
              <div
                className="p-3.5 rounded-2xl border shadow-xs flex items-center justify-between gap-3 transition-all"
                style={{
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.cardBorder
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                    🧃
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-black truncate" style={{ color: colors.titleText }}>
                      FRUTON SURTIDO
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black" style={{ color: colors.priceAccent }}>
                        $0.70
                      </span>
                      <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded-md">
                        12 en nevera
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    style={{
                      backgroundColor: colors.stepperButtonBg,
                      color: colors.stepperButtonText
                    }}
                    className="w-7 h-7 rounded-lg font-bold flex items-center justify-center shadow-xs text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Buttons Preview Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Primary Action Button */}
              <button
                type="button"
                style={{
                  backgroundColor: colors.primaryButtonBg,
                  color: colors.primaryButtonText
                }}
                className="py-3 px-4 rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Botón Principal: Continuar / Pagar Ahora ({colors.primaryButtonBg})</span>
              </button>

              {/* Secondary Quincena Button */}
              <button
                type="button"
                style={{
                  backgroundColor: colors.secondaryButtonBg,
                  color: colors.secondaryButtonText
                }}
                className="py-3 px-4 rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>Botón Secundario: Pagar para el 15 ({colors.secondaryButtonBg})</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECCIONES CATEGORIZADAS DE SELECTORES DE COLOR CON HEX */}
        <div className="space-y-6 pt-2">
          {colorCategories.map((category) => (
            <div key={category.title} className="space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                {category.icon}
                <div>
                  <h4 className="text-xs font-black text-slate-900">{category.title}</h4>
                  <p className="text-[10px] text-slate-500">{category.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {category.fields.map((field) => {
                  const rawColor = colors[field.key] || '#000000';
                  const pickerHex = toColorPickerHex(rawColor);
                  const isCopied = copiedKey === field.key;

                  return (
                    <div
                      key={field.key}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <label className="text-xs font-bold text-slate-900 block leading-tight">
                            {field.label}
                          </label>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                            {field.description}
                          </p>
                        </div>

                        {/* Copy HEX button */}
                        <button
                          type="button"
                          onClick={() => handleCopyHex(field.key, rawColor)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                          title="Copiar código HEX"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Visual Color Picker */}
                        <div
                          className="relative w-9 h-9 rounded-xl border border-slate-300 shadow-xs overflow-hidden shrink-0 cursor-pointer"
                          title="Haz clic para seleccionar el color visualmente"
                        >
                          <input
                            type="color"
                            value={pickerHex}
                            onChange={(e) => updateColorKey(field.key, e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer scale-150"
                          />
                          <div
                            className="w-full h-full rounded-xl transition-colors"
                            style={{ backgroundColor: rawColor }}
                          />
                        </div>

                        {/* Exact HEX text input */}
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            maxLength={9}
                            value={rawColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateColorKey(field.key, val);
                            }}
                            onBlur={(e) => {
                              // Ensure clean format on blur
                              const clean = sanitizeHex(e.target.value);
                              updateColorKey(field.key, clean);
                            }}
                            placeholder="#000000"
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 uppercase tracking-wider"
                          />
                        </div>

                        {/* Visual Swatch Tag */}
                        <span
                          className="w-6 h-6 rounded-lg border border-slate-200 shrink-0 shadow-2xs"
                          style={{ backgroundColor: rawColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 2: LOGO DEL NEGOCIO */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Logo del Negocio</h3>
            <p className="text-xs text-slate-500">Aparece al principio en el Kiosco y en la imagen de cobro para WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-purple-400 transition-colors bg-slate-50 relative group flex flex-col items-center justify-center min-h-[140px]">
            {formData.logoUrl ? (
              <div className="relative group w-full flex flex-col items-center">
                <div className="w-20 h-20 p-1.5 bg-white rounded-2xl shadow-md border border-slate-200 flex items-center justify-center overflow-hidden">
                  <img
                    src={formData.logoUrl}
                    alt="Logo actual"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                  className="mt-2 text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Quitar logo
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-7 h-7 text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700 block">Subir Logo desde tu dispositivo</span>
                <span className="text-[10px] text-slate-400 block">PNG, JPG, SVG o WEBP</span>
              </>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Seleccionar archivo de logo"
            />
          </div>

          <div className="space-y-2 flex flex-col justify-center">
            <label className="text-xs font-bold text-slate-700">O ingresa un enlace web directo al logo:</label>
            <input
              type="url"
              placeholder="https://ejemplo.com/logo.png"
              value={formData.logoUrl && formData.logoUrl.startsWith('data:') ? '' : (formData.logoUrl || '')}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Se recomienda un logo con fondo transparente para que combine perfectamente con los colores que configures.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: INFORMACIÓN DEL NEGOCIO & PAGO MÓVIL */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Datos del Kiosco y Pago Móvil</h3>
            <p className="text-xs text-slate-500">Títulos y datos bancarios que se envían por WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Nombre del Kiosco / Negocio:</label>
            <input
              type="text"
              required
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Símbolo de Moneda:</label>
            <input
              type="text"
              required
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none font-bold"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Subtítulo / Instrucción visible en el Kiosco:</label>
          <input
            type="text"
            value={formData.businessSubtitle}
            onChange={(e) => setFormData({ ...formData, businessSubtitle: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Datos de Pago Móvil / Banco (para cobrar por WhatsApp):</span>
            <span className="text-[10px] text-slate-400 font-normal">Aparece en la imagen y texto para WhatsApp</span>
          </label>
          <textarea
            rows={4}
            value={formData.paymentInfo}
            onChange={(e) => setFormData({ ...formData, paymentInfo: e.target.value })}
            placeholder="Transferencia / Pago Móvil: 04140153904&#10;Banco: Banesco / Venezuela / BBVA&#10;C.I: 12.345.678&#10;Titular: Andrés Omaña"
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none font-mono resize-none"
          />
        </div>
      </div>

      {/* SECCIÓN 4: GOOGLE SHEETS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sincronización con Google Sheets</h3>
              <p className="text-xs text-slate-500">Envía cada pedido automáticamente a tu hoja de cálculo</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenGoogleSheetGuide}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline"
          >
            Ver Guía de Conexión
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">URL del Webhook de Google Apps Script:</label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              value={formData.scriptUrl}
              onChange={(e) => setFormData({ ...formData, scriptUrl: e.target.value })}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none font-mono"
            />
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTest}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
              Probar Conexión
            </button>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* SECCIÓN 5: SEGURIDAD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Seguridad del Administrador</h3>
            <p className="text-xs text-slate-500">Contraseña para ingresar a este panel de administración</p>
          </div>
        </div>

        <div className="max-w-xs space-y-1">
          <label className="text-xs font-bold text-slate-700">Contraseña de Administrador:</label>
          <input
            type="password"
            maxLength={30}
            value={formData.adminPin}
            onChange={(e) => setFormData({ ...formData, adminPin: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white outline-none font-bold tracking-widest"
          />
          <p className="text-[11px] text-slate-400">
            Contraseña requerida para acceder al panel de administración y cobranza.
          </p>
        </div>
      </div>

      {/* Cartel NFC */}
      <div
        className="p-5 rounded-2xl shadow-md flex items-center justify-between text-white"
        style={{ backgroundColor: colors.headerBg }}
      >
        <div className="space-y-1">
          <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: colors.headerText }}>
            <Radio className="w-4 h-4" />
            ¿Quieres configurar tu sticker NFC o imprimir el cartel?
          </h4>
          <p className="text-xs opacity-90" style={{ color: colors.headerText }}>
            Obtén el enlace directo y el código QR listo para imprimir y pegar en la nevera.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNfcGuide}
          className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0"
        >
          Ver Cartel & QR
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          style={{
            backgroundColor: colors.primaryButtonBg,
            color: colors.primaryButtonText
          }}
          className="px-6 py-3 font-black text-sm rounded-xl shadow-md transition-all flex items-center gap-2 hover:opacity-90 active:scale-95"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Todas las Configuraciones
        </button>
      </div>

      {/* Zona de peligro: borrar todo el historial */}
      {onOpenResetData && (
        <div className="p-5 rounded-2xl border-2 border-rose-200 bg-rose-50/60 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-600" />
            <h4 className="text-sm font-black text-rose-700">Zona de peligro</h4>
          </div>
          <p className="text-xs text-rose-800/80 leading-relaxed">
            Borra <strong>todo el historial</strong>: ventas, deudas, consumos y abonos/pagos registrados.
            Esta acción no se puede deshacer desde la app. Se guarda un respaldo automático en el servidor por si necesitas recuperarlo.
          </p>
          <button
            type="button"
            onClick={onOpenResetData}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            Borrar todo el historial
          </button>
        </div>
      )}
    </form>
  );
};
