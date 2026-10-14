import { CustomThemeColors, ThemeColorId } from '../types';

export interface ThemeStyles {
  id: ThemeColorId;
  name: string;
  previewBg: string;
  primaryBg: string;
  primaryHover: string;
  primaryLightBg: string;
  primaryLightBorder: string;
  primaryText: string;
  primaryDarkText: string;
  gradientHeader: string;
  accentBadge: string;
  ringFocus: string;
  canvasPrimaryHex: string;
  canvasSecondaryHex: string;
}

export const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  // Fondo y Estructura
  appBackground: '#f1f5f9',
  sectionCardBg: '#ffffff',

  // Encabezado y Marca
  headerBg: '#065f46',
  headerText: '#ffffff',

  // Productos y Textos
  cardBackground: '#ffffff',
  cardBorder: '#e2e8f0',
  titleText: '#0f172a',
  priceAccent: '#059669',

  // Botones y Acciones
  primaryButtonBg: '#059669',
  primaryButtonText: '#ffffff',
  secondaryButtonBg: '#1e293b',
  secondaryButtonText: '#ffffff',
  stepperButtonBg: '#059669',
  stepperButtonText: '#ffffff',
  categoryActiveBg: '#059669',
  categoryActiveText: '#ffffff',
  adminButtonBg: '#0f172a',
  adminButtonText: '#34d399'
};

export interface ThemePreset {
  id: string;
  name: string;
  colors: CustomThemeColors;
}

export const COLOR_PRESETS: ThemePreset[] = [
  {
    id: 'emerald',
    name: 'Esmeralda Kiosco (Verde)',
    colors: {
      appBackground: '#f1f5f9',
      sectionCardBg: '#ffffff',
      headerBg: '#065f46',
      headerText: '#ffffff',
      cardBackground: '#ffffff',
      cardBorder: '#e2e8f0',
      titleText: '#0f172a',
      priceAccent: '#059669',
      primaryButtonBg: '#059669',
      primaryButtonText: '#ffffff',
      secondaryButtonBg: '#1e293b',
      secondaryButtonText: '#ffffff',
      stepperButtonBg: '#059669',
      stepperButtonText: '#ffffff',
      categoryActiveBg: '#059669',
      categoryActiveText: '#ffffff',
      adminButtonBg: '#0f172a',
      adminButtonText: '#34d399'
    }
  },
  {
    id: 'dark',
    name: 'Modo Oscuro / Carbón',
    colors: {
      appBackground: '#0b0f19',
      sectionCardBg: '#111827',
      headerBg: '#0f172a',
      headerText: '#f8fafc',
      cardBackground: '#161e2e',
      cardBorder: '#2d3748',
      titleText: '#f8fafc',
      priceAccent: '#34d399',
      primaryButtonBg: '#10b981',
      primaryButtonText: '#0f172a',
      secondaryButtonBg: '#374151',
      secondaryButtonText: '#f9fafb',
      stepperButtonBg: '#10b981',
      stepperButtonText: '#0f172a',
      categoryActiveBg: '#10b981',
      categoryActiveText: '#0f172a',
      adminButtonBg: '#1f2937',
      adminButtonText: '#10b981'
    }
  },
  {
    id: 'blue',
    name: 'Azul Océano & Marino',
    colors: {
      appBackground: '#eff6ff',
      sectionCardBg: '#ffffff',
      headerBg: '#1e40af',
      headerText: '#ffffff',
      cardBackground: '#ffffff',
      cardBorder: '#bfdbfe',
      titleText: '#1e3a8a',
      priceAccent: '#2563eb',
      primaryButtonBg: '#2563eb',
      primaryButtonText: '#ffffff',
      secondaryButtonBg: '#1e293b',
      secondaryButtonText: '#ffffff',
      stepperButtonBg: '#2563eb',
      stepperButtonText: '#ffffff',
      categoryActiveBg: '#2563eb',
      categoryActiveText: '#ffffff',
      adminButtonBg: '#1e3a8a',
      adminButtonText: '#60a5fa'
    }
  },
  {
    id: 'purple',
    name: 'Púrpura & Violeta',
    colors: {
      appBackground: '#faf5ff',
      sectionCardBg: '#ffffff',
      headerBg: '#6b21a8',
      headerText: '#ffffff',
      cardBackground: '#ffffff',
      cardBorder: '#e9d5ff',
      titleText: '#581c87',
      priceAccent: '#9333ea',
      primaryButtonBg: '#9333ea',
      primaryButtonText: '#ffffff',
      secondaryButtonBg: '#3b0764',
      secondaryButtonText: '#ffffff',
      stepperButtonBg: '#9333ea',
      stepperButtonText: '#ffffff',
      categoryActiveBg: '#9333ea',
      categoryActiveText: '#ffffff',
      adminButtonBg: '#3b0764',
      adminButtonText: '#c084fc'
    }
  },
  {
    id: 'amber',
    name: 'Ámbar & Naranja Cálido',
    colors: {
      appBackground: '#fffbeb',
      sectionCardBg: '#ffffff',
      headerBg: '#b45309',
      headerText: '#ffffff',
      cardBackground: '#ffffff',
      cardBorder: '#fde68a',
      titleText: '#78350f',
      priceAccent: '#d97706',
      primaryButtonBg: '#d97706',
      primaryButtonText: '#ffffff',
      secondaryButtonBg: '#1c1917',
      secondaryButtonText: '#ffffff',
      stepperButtonBg: '#d97706',
      stepperButtonText: '#ffffff',
      categoryActiveBg: '#d97706',
      categoryActiveText: '#ffffff',
      adminButtonBg: '#1c1917',
      adminButtonText: '#fbbf24'
    }
  },
  {
    id: 'rose',
    name: 'Rosa & Carmesí',
    colors: {
      appBackground: '#fff1f2',
      sectionCardBg: '#ffffff',
      headerBg: '#9f1239',
      headerText: '#ffffff',
      cardBackground: '#ffffff',
      cardBorder: '#fecdd3',
      titleText: '#881337',
      priceAccent: '#e11d48',
      primaryButtonBg: '#e11d48',
      primaryButtonText: '#ffffff',
      secondaryButtonBg: '#1f2937',
      secondaryButtonText: '#ffffff',
      stepperButtonBg: '#e11d48',
      stepperButtonText: '#ffffff',
      categoryActiveBg: '#e11d48',
      categoryActiveText: '#ffffff',
      adminButtonBg: '#4c0519',
      adminButtonText: '#fb7185'
    }
  },
  {
    id: 'cyan',
    name: 'Turquesa / Nevera Polar',
    colors: {
      appBackground: '#ecfeff',
      sectionCardBg: '#ffffff',
      headerBg: '#155e75',
      headerText: '#ffffff',
      cardBackground: '#ffffff',
      cardBorder: '#a5f3fc',
      titleText: '#164e63',
      priceAccent: '#0891b2',
      primaryButtonBg: '#0891b2',
      primaryButtonText: '#ffffff',
      secondaryButtonBg: '#164e63',
      secondaryButtonText: '#ffffff',
      stepperButtonBg: '#0891b2',
      stepperButtonText: '#ffffff',
      categoryActiveBg: '#0891b2',
      categoryActiveText: '#ffffff',
      adminButtonBg: '#083344',
      adminButtonText: '#22d3ee'
    }
  }
];

export const THEMES: Record<ThemeColorId, ThemeStyles> = {
  emerald: {
    id: 'emerald',
    name: 'Esmeralda Kiosco (Verde)',
    previewBg: 'bg-emerald-500',
    primaryBg: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-700',
    primaryLightBg: 'bg-emerald-50',
    primaryLightBorder: 'border-emerald-200',
    primaryText: 'text-emerald-600',
    primaryDarkText: 'text-emerald-800',
    gradientHeader: 'from-emerald-600 via-teal-600 to-emerald-700',
    accentBadge: 'bg-emerald-100 text-emerald-800',
    ringFocus: 'focus:border-emerald-500 focus:ring-emerald-500/20',
    canvasPrimaryHex: '#059669',
    canvasSecondaryHex: '#0d9488'
  },
  blue: {
    id: 'blue',
    name: 'Azul Océano',
    previewBg: 'bg-blue-500',
    primaryBg: 'bg-blue-600',
    primaryHover: 'hover:bg-blue-700',
    primaryLightBg: 'bg-blue-50',
    primaryLightBorder: 'border-blue-200',
    primaryText: 'text-blue-600',
    primaryDarkText: 'text-blue-800',
    gradientHeader: 'from-blue-600 via-indigo-600 to-blue-700',
    accentBadge: 'bg-blue-100 text-blue-800',
    ringFocus: 'focus:border-blue-500 focus:ring-blue-500/20',
    canvasPrimaryHex: '#2563eb',
    canvasSecondaryHex: '#4f46e5'
  },
  purple: {
    id: 'purple',
    name: 'Púrpura & Violeta',
    previewBg: 'bg-purple-500',
    primaryBg: 'bg-purple-600',
    primaryHover: 'hover:bg-purple-700',
    primaryLightBg: 'bg-purple-50',
    primaryLightBorder: 'border-purple-200',
    primaryText: 'text-purple-600',
    primaryDarkText: 'text-purple-800',
    gradientHeader: 'from-purple-600 via-fuchsia-600 to-purple-700',
    accentBadge: 'bg-purple-100 text-purple-800',
    ringFocus: 'focus:border-purple-500 focus:ring-purple-500/20',
    canvasPrimaryHex: '#9333ea',
    canvasSecondaryHex: '#c026d3'
  },
  amber: {
    id: 'amber',
    name: 'Ámbar & Naranja Cálido',
    previewBg: 'bg-amber-500',
    primaryBg: 'bg-amber-600',
    primaryHover: 'hover:bg-amber-700',
    primaryLightBg: 'bg-amber-50',
    primaryLightBorder: 'border-amber-200',
    primaryText: 'text-amber-600',
    primaryDarkText: 'text-amber-800',
    gradientHeader: 'from-amber-600 via-orange-600 to-amber-700',
    accentBadge: 'bg-amber-100 text-amber-800',
    ringFocus: 'focus:border-amber-500 focus:ring-amber-500/20',
    canvasPrimaryHex: '#d97706',
    canvasSecondaryHex: '#ea580c'
  },
  rose: {
    id: 'rose',
    name: 'Rosa & Carmesí',
    previewBg: 'bg-rose-500',
    primaryBg: 'bg-rose-600',
    primaryHover: 'hover:bg-rose-700',
    primaryLightBg: 'bg-rose-50',
    primaryLightBorder: 'border-rose-200',
    primaryText: 'text-rose-600',
    primaryDarkText: 'text-rose-800',
    gradientHeader: 'from-rose-600 via-pink-600 to-rose-700',
    accentBadge: 'bg-rose-100 text-rose-800',
    ringFocus: 'focus:border-rose-500 focus:ring-rose-500/20',
    canvasPrimaryHex: '#e11d48',
    canvasSecondaryHex: '#db2777'
  },
  cyan: {
    id: 'cyan',
    name: 'Turquesa / Nevera Fría',
    previewBg: 'bg-cyan-500',
    primaryBg: 'bg-cyan-600',
    primaryHover: 'hover:bg-cyan-700',
    primaryLightBg: 'bg-cyan-50',
    primaryLightBorder: 'border-cyan-200',
    primaryText: 'text-cyan-600',
    primaryDarkText: 'text-cyan-800',
    gradientHeader: 'from-cyan-600 via-teal-600 to-cyan-700',
    accentBadge: 'bg-cyan-100 text-cyan-800',
    ringFocus: 'focus:border-cyan-500 focus:ring-cyan-500/20',
    canvasPrimaryHex: '#0891b2',
    canvasSecondaryHex: '#0d9488'
  },
  slate: {
    id: 'slate',
    name: 'Carbón / Minimalista',
    previewBg: 'bg-slate-700',
    primaryBg: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-900',
    primaryLightBg: 'bg-slate-100',
    primaryLightBorder: 'border-slate-300',
    primaryText: 'text-slate-800',
    primaryDarkText: 'text-slate-900',
    gradientHeader: 'from-slate-800 via-zinc-800 to-slate-900',
    accentBadge: 'bg-slate-200 text-slate-800',
    ringFocus: 'focus:border-slate-500 focus:ring-slate-500/20',
    canvasPrimaryHex: '#1e293b',
    canvasSecondaryHex: '#334155'
  }
};

export function getTheme(themeId?: ThemeColorId): ThemeStyles {
  return THEMES[themeId || 'emerald'] || THEMES.emerald;
}

export function getEffectiveCustomColors(customColors?: Partial<CustomThemeColors>): CustomThemeColors {
  return {
    ...DEFAULT_CUSTOM_COLORS,
    ...(customColors || {})
  };
}

// Helper to sanitize and normalize hex color codes
export function sanitizeHex(value: string): string {
  let clean = value.trim();
  if (!clean) return '#000000';
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  return clean;
}

// Convert any hex into a strict 7-character #RRGGBB for <input type="color">
export function toColorPickerHex(hex: string, fallback = '#059669'): string {
  const clean = sanitizeHex(hex);
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
    return clean;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    return '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  return fallback;
}
