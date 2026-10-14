import { AppSettings, CatalogProduct, OrderRecord, PaymentRecord, SyncResponse, ImportBatchMeta } from '../types';

export async function fetchInitialData(): Promise<{
  orders: OrderRecord[];
  products: CatalogProduct[];
  payments: PaymentRecord[];
  settings: AppSettings;
}> {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Error al cargar datos del servidor');
    const data = await res.json();
    return {
      orders: data.orders || [],
      products: data.products || [],
      payments: data.payments || [],
      settings: data.settings || {
        scriptUrl: '',
        currency: '$',
        businessName: 'Kiosco & Frigobar de Confianza',
        businessSubtitle: 'Acerca tu celular al NFC, anota lo que te llevas y paga en la quincena',
        paymentInfo: 'Transferencia / Pago Móvil: 04140153904 / Andrés Omaña',
        adminPin: '4520091'
      }
    };
  } catch (err) {
    console.error('Fetch data error:', err);
    return {
      orders: [],
      products: [],
      payments: [],
      settings: {
        scriptUrl: '',
        currency: '$',
        businessName: 'Kiosco & Frigobar de Confianza',
        businessSubtitle: 'Acerca tu celular al NFC, anota lo que te llevas y paga en la quincena',
        paymentInfo: 'Transferencia / Pago Móvil: 04140153904 / Andrés Omaña',
        adminPin: '4520091'
      }
    };
  }
}

export async function submitOrder(orderData: {
  nombre: string;
  telefono: string;
  items: Array<{ nombre: string; cantidad: number; precio: number; emoji?: string; imagenUrl?: string }>;
  producto: string;
  cantidad: number;
  monto: number;
  notas?: string;
  tipoPago?: 'pagar_ahora' | 'pagar_quincena';
  estadoPago?: 'pendiente' | 'pagado';
}): Promise<SyncResponse> {
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        message: json.message || 'Error al guardar el pedido'
      };
    }
    return {
      success: true,
      message: '¡Pedido registrado con éxito!',
      order: json.order
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error de conexión con el servidor'
    };
  }
}

export async function updateOrder(id: string, updates: Partial<OrderRecord>): Promise<boolean> {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch (err) {
    console.error('Update order error:', err);
    return false;
  }
}

export async function deleteOrder(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('Delete order error:', err);
    return false;
  }
}

// Borra TODO el historial de ventas/deudas y los abonos/pagos registrados
export async function resetAllData(options: {
  clearOrders?: boolean;
  clearPayments?: boolean;
} = {}): Promise<{
  success: boolean;
  removedOrders?: number;
  removedPayments?: number;
  orders?: OrderRecord[];
  payments?: PaymentRecord[];
  message?: string;
}> {
  try {
    const res = await fetch('/api/reset-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clearOrders: options.clearOrders !== false,
        clearPayments: options.clearPayments !== false
      })
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al borrar el historial' };
  }
}

export async function bulkSettleBuyerOrders(buyerName: string, estadoPago: 'pagado' | 'pendiente'): Promise<boolean> {
  try {
    const res = await fetch('/api/orders/bulk-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerName, estadoPago })
    });
    return res.ok;
  } catch (err) {
    console.error('Bulk settle error:', err);
    return false;
  }
}

// Record new payment (quien me pago / abono a deuda)
export async function recordPayment(paymentData: {
  nombre: string;
  monto: number;
  metodo: string;
  nota?: string;
  fecha?: string;
  saldoRestante?: number;
}): Promise<{ success: boolean; payment?: PaymentRecord; message?: string }> {
  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al registrar pago' };
  }
}

export async function deletePayment(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('Delete payment error:', err);
    return false;
  }
}

export async function saveProductsCatalog(products: CatalogProduct[]): Promise<boolean> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products })
    });
    return res.ok;
  } catch (err) {
    console.error('Save products error:', err);
    return false;
  }
}

export async function updateProductInventory(productId: string, stockNevera: number, stockDeposito: number): Promise<boolean> {
  try {
    const res = await fetch('/api/products/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, stockNevera, stockDeposito })
    });
    return res.ok;
  } catch (err) {
    console.error('Update product inventory error:', err);
    return false;
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    return res.ok;
  } catch (err) {
    console.error('Save settings error:', err);
    return false;
  }
}

export async function testGoogleSheetsConnection(scriptUrl: string): Promise<SyncResponse> {
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl })
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error de conexión con el servidor local'
    };
  }
}

// Bulk import orders and payments from parsed XLSX
export async function importXLSXData(payload: {
  orders: OrderRecord[];
  payments: PaymentRecord[];
  replaceMode: boolean;
  fileName?: string;
}): Promise<{
  success: boolean;
  message: string;
  orders?: OrderRecord[];
  payments?: PaymentRecord[];
  ordersCount?: number;
  paymentsCount?: number;
  imports?: ImportBatchMeta[];
}> {
  try {
    const res = await fetch('/api/import-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error de conexión al importar datos'
    };
  }
}

// Lista de importaciones realizadas (para poder deshacer)
export async function fetchImportBatches(): Promise<ImportBatchMeta[]> {
  try {
    const res = await fetch('/api/imports');
    if (!res.ok) return [];
    const data = await res.json();
    return data.imports || [];
  } catch (err) {
    console.error('Fetch imports error:', err);
    return [];
  }
}

// Deshacer una importación: elimina los datos que agregó ese archivo XLSX
export async function undoImportBatch(
  id: string,
  options?: { removeOrders?: boolean; removePayments?: boolean }
): Promise<{
  success: boolean;
  message: string;
  removedOrders?: number;
  removedPayments?: number;
  orders?: OrderRecord[];
  payments?: PaymentRecord[];
  imports?: ImportBatchMeta[];
}> {
  try {
    const res = await fetch(`/api/imports/${id}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        removeOrders: options?.removeOrders !== false,
        removePayments: options?.removePayments !== false
      })
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error de conexión al deshacer la importación'
    };
  }
}
