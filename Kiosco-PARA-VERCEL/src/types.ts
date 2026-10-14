export interface OrderItem {
  id?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  emoji?: string;
  imagenUrl?: string;
}

export interface OrderRecord {
  id: string;
  fecha: string; // ISO string
  nombre: string;
  telefono: string;
  producto: string;
  cantidad: number;
  items?: OrderItem[];
  monto: number;
  notas?: string;
  tipoPago?: 'pagar_ahora' | 'pagar_quincena'; // Pagar Ahora vs Pagar el 15
  estadoPago: 'pendiente' | 'pagado';
  fechaPago?: string;
  syncStatus: 'synced' | 'pending' | 'failed' | 'local';
  syncMessage?: string;
}

export interface PaymentRecord {
  id: string;
  fecha: string;
  nombre: string;
  monto: number;
  metodo: string; // 'Pago Móvil', 'Efectivo', 'Transferencia', 'Zelle', etc.
  nota?: string;
  saldoRestante?: number; // Cuánto le queda por pagar después de este abono
}

export interface CatalogProduct {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  emoji?: string;
  imagenUrl?: string; // Foto del producto en base64 o URL
  promo?: string;
  stockNevera: number; // Lo que hay dentro de la nevera
  stockDeposito: number; // Lo que hay en inventario / almacén
  stock?: number; // Total disponible (nevera + depósito)
}

export type ThemeColorId = 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'cyan' | 'slate';

export interface CustomThemeColors {
  // Fondo y Estructura
  appBackground: string;        // Fondo de la app / pantalla (ej: #f1f5f9)
  sectionCardBg: string;        // Fondo de las cajas de paso (ej: #ffffff)
  
  // Encabezado y Marca
  headerBg: string;             // Fondo del encabezado / banner (ej: #065f46)
  headerText: string;           // Texto del encabezado / títulos del banner (ej: #ffffff)
  
  // Productos y Textos
  cardBackground: string;       // Fondo de tarjetas de productos (ej: #ffffff)
  cardBorder: string;           // Borde y líneas de tarjetas (ej: #e2e8f0)
  titleText: string;            // Color nombres de productos y títulos (ej: #0f172a)
  priceAccent: string;          // Color de precios y ofertas destacadas (ej: #059669)
  
  // Botones y Acciones
  primaryButtonBg: string;      // Botón principal de acción ('Continuar Compra', 'Pagar Ahora') (ej: #059669)
  primaryButtonText: string;    // Texto del botón principal (ej: #ffffff)
  secondaryButtonBg: string;    // Botón secundario ('Pagar para el 15') (ej: #1e293b)
  secondaryButtonText: string;  // Texto del botón secundario (ej: #ffffff)
  stepperButtonBg: string;      // Botones de cantidad (+ y -) activos (ej: #059669)
  stepperButtonText: string;    // Texto/icono de botones de cantidad (ej: #ffffff)
  categoryActiveBg: string;     // Pestaña de categoría seleccionada (ej: #059669)
  categoryActiveText: string;   // Texto de categoría seleccionada (ej: #ffffff)
  adminButtonBg: string;        // Botón de Acceso a Administrador (ej: #0f172a)
  adminButtonText: string;      // Texto del botón de Acceso a Administrador (ej: #34d399)
}

export interface AppSettings {
  scriptUrl: string;
  currency: string;
  businessName: string;
  businessSubtitle: string;
  paymentInfo: string; // Datos Pago Móvil / Banco
  adminPin: string;
  logoUrl?: string; // Logo del negocio al principio
  themeColor?: ThemeColorId; // Color tema de la app
  customColors?: CustomThemeColors; // Colores personalizados exactos con código HEX
}

export interface BuyerSummary {
  nombre: string;
  telefono: string;
  totalMonto: number;
  montoPendiente: number; // Qué falta por pagar (cuánto debe)
  montoPagado: number;    // Quién me pagó / ya pagado
  totalProductos: number;
  ordenes: OrderRecord[];
  pagos: PaymentRecord[];
  productosDesglose: Record<string, { cantidad: number; total: number; precioUnitario: number; emoji?: string; imagenUrl?: string }>;
  ultimaCompra: string;
  estadoGeneral: 'al_dia' | 'deudor';
}

export interface SyncResponse {
  success: boolean;
  message: string;
  order?: OrderRecord;
  payloadSent?: any;
  response?: any;
  raw?: string;
}

// Lote de importación XLSX (permite deshacer lo que agregó un archivo)
export interface ImportBatchMeta {
  id: string;
  fecha: string;
  fileName?: string;
  replaceMode: boolean;
  ordersAdded: number;
  paymentsAdded: number;
  addedOrderIds: string[];
  addedPaymentIds: string[];
  hasSnapshot?: boolean;
}
