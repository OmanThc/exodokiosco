import * as XLSX from 'xlsx';
import { OrderRecord, PaymentRecord, OrderItem } from '../types';

export interface ParsedImportData {
  orders: OrderRecord[];
  payments: PaymentRecord[];
  buyersSummary: {
    nombre: string;
    telefono: string;
    totalProductos: number;
    totalMonto: number;
    totalAbonado: number;
    saldoDebe: number;
    estado: 'PAGADO' | 'PENDIENTE';
    productos: string[];
    cantidadItems: number;
  }[];
  stats: {
    totalOrders: number;
    totalPayments: number;
    totalUniqueBuyers: number;
    totalMonto: number;
    totalAbonado: number;
    totalDeuda: number;
    sheetsFound: string[];
  };
  warnings: string[];
}

// Helper to normalize strings for flexible column matching
function normalizeKey(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Find a value in a row given multiple possible column names
function getRowValue(row: Record<string, any>, possibleNames: string[]): any {
  const normalizedTargets = possibleNames.map(normalizeKey);
  for (const key of Object.keys(row)) {
    const normKey = normalizeKey(key);
    if (normalizedTargets.includes(normKey)) {
      return row[key];
    }
  }
  // Also check if any key starts with or includes target
  for (const key of Object.keys(row)) {
    const normKey = normalizeKey(key);
    for (const target of normalizedTargets) {
      if (normKey.includes(target) || target.includes(normKey)) {
        return row[key];
      }
    }
  }
  return undefined;
}

// Convert Excel dates (number serial or string) to standard ISO string
function parseExcelDate(val: any, timeVal?: any): string {
  if (!val) return new Date().toISOString();

  // If XLSX date serial number
  if (typeof val === 'number') {
    // Excel base date is 1899-12-30
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      if (typeof timeVal === 'number') {
        const timeMs = Math.round(timeVal * 86400 * 1000);
        const hours = Math.floor(timeMs / 3600000);
        const mins = Math.floor((timeMs % 3600000) / 60000);
        date.setHours(hours, mins, 0);
      }
      return date.toISOString();
    }
  }

  // If string
  const str = String(val).trim();
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const d = new Date(year, month, day, hour, min);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Fallback to standard Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();

  return new Date().toISOString();
}

// Parse string product lists like "2x MALTA, 1x FRUTON" or "MALTA + FRUTON"
export function parseProductsDescription(prodText: string, totalAmount: number): { items: OrderItem[]; totalQty: number } {
  if (!prodText) {
    return {
      items: [{ nombre: 'Consumo registrado', precio: totalAmount, cantidad: 1 }],
      totalQty: 1
    };
  }

  const items: OrderItem[] = [];
  // Split by comma, semicolon, or plus sign
  const parts = prodText.split(/[,;\+\n]/).map(p => p.trim()).filter(Boolean);

  let totalQty = 0;
  for (const part of parts) {
    // Check patterns like: "2x Coca Cola", "2 Coca Cola", "Coca Cola (2)", "Coca Cola x2"
    let qty = 1;
    let name = part;

    const qtyFirstMatch = part.match(/^(\d+)\s*[xX*]?\s+(.+)$/);
    const qtyLastMatch = part.match(/^(.+?)\s*\(?x?(\d+)\)?$/i);

    if (qtyFirstMatch) {
      qty = parseInt(qtyFirstMatch[1], 10) || 1;
      name = qtyFirstMatch[2].trim();
    } else if (qtyLastMatch && !isNaN(Number(qtyLastMatch[2]))) {
      name = qtyLastMatch[1].trim();
      qty = parseInt(qtyLastMatch[2], 10) || 1;
    }

    // Clean any price in parenthesis like "MALTA ($1.00)"
    name = name.replace(/\(\$?[0-9.,]+\)/g, '').trim();

    totalQty += qty;
    items.push({
      nombre: name,
      cantidad: qty,
      precio: 0 // Price per item will be proportional if not specified
    });
  }

  if (items.length === 0) {
    return {
      items: [{ nombre: prodText.trim(), precio: totalAmount, cantidad: 1 }],
      totalQty: 1
    };
  }

  // Distribute total amount among items if known
  const unitPrice = totalQty > 0 ? Math.round((totalAmount / totalQty) * 100) / 100 : 0;
  for (const it of items) {
    it.precio = unitPrice;
  }

  return { items, totalQty };
}

/**
 * Main parser: Reads an ArrayBuffer or binary from XLSX and produces structured records.
 */
export async function parseXLSXFile(fileBuffer: ArrayBuffer): Promise<ParsedImportData> {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const warnings: string[] = [];
  const sheetsFound = wb.SheetNames;

  if (sheetsFound.length === 0) {
    throw new Error('El archivo Excel no contiene ninguna hoja.');
  }

  const orders: OrderRecord[] = [];
  const payments: PaymentRecord[] = [];

  // 1. Inspect all sheets.
  // We look for:
  // - "Historial de Pedidos" / "Ordenes" / "Consumos" / "Ventas" (individual order records)
  // - "Resumen Compradores" / "Compradores" / "Cuentas" / "Clientes" (buyer summary records)
  // - "Abonos" / "Pagos" (payment records)
  // If only a generic sheet (e.g. Sheet1) is present, we detect row structure.

  for (const sheetName of sheetsFound) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // Convert sheet to json rows
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    if (!rows || rows.length === 0) continue;

    const normSheetName = normalizeKey(sheetName);

    // If it's a specific Abonos/Pagos sheet:
    if (normSheetName.includes('abono') || normSheetName.includes('pago')) {
      for (const row of rows) {
        const nombre = getRowValue(row, ['nombre', 'cliente', 'comprador', 'titular']);
        const monto = parseFloat(getRowValue(row, ['monto', 'abono', 'pago', 'montoabonado', 'cantidad']) || 0);
        if (!nombre || isNaN(monto) || monto <= 0) continue;

        const fechaRaw = getRowValue(row, ['fecha', 'fechapago', 'date', 'hora']);
        const horaRaw = getRowValue(row, ['hora', 'time']);
        const metodo = getRowValue(row, ['metodo', 'formapago', 'metodopago', 'tipo']) || 'Pago Móvil';
        const nota = getRowValue(row, ['nota', 'notas', 'referencia', 'concepto', 'observacion']) || '';
        const saldoRestanteVal = getRowValue(row, ['saldorestante', 'lequedo', 'porpagar', 'deuda']);
        const saldoRestante = saldoRestanteVal !== undefined && !isNaN(parseFloat(saldoRestanteVal))
          ? parseFloat(saldoRestanteVal)
          : undefined;

        payments.push({
          id: 'pay-imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          nombre: String(nombre).trim(),
          monto: Math.round(monto * 100) / 100,
          metodo: String(metodo).trim(),
          nota: String(nota).trim(),
          fecha: parseExcelDate(fechaRaw, horaRaw),
          saldoRestante
        });
      }
      continue;
    }

    // If it's a "Resumen Compradores" sheet:
    if (normSheetName.includes('resumen') || normSheetName.includes('comprador') || normSheetName.includes('cuenta')) {
      for (const row of rows) {
        const nombre = getRowValue(row, ['nombre', 'nombrecomprador', 'cliente', 'comprador']);
        if (!nombre) continue;

        const telefono = String(getRowValue(row, ['telefono', 'celular', 'tlf']) || '').trim();
        const totalProductos = parseInt(getRowValue(row, ['totalproductos', 'productos', 'cantidad']) || 0, 10);
        const montoPendiente = parseFloat(getRowValue(row, ['porpagar', 'debe', 'saldo', 'montopendiente', 'deuda']) || 0);
        const montoPagado = parseFloat(getRowValue(row, ['yapagado', 'pagado', 'abono', 'abonado', 'montopagado']) || 0);
        const totalMonto = parseFloat(getRowValue(row, ['totalacumulado', 'total', 'monto', 'totalconsumido']) || 0);
        const estadoVal = String(getRowValue(row, ['estado', 'status']) || '').toLowerCase();
        const productosDesglose = String(getRowValue(row, ['desglosedeconsumo', 'productos', 'detalle', 'quecompro', 'articulos']) || '').trim();
        const fechaRaw = getRowValue(row, ['ultimoregistro', 'fecha', 'fechacompra']);

        // Check if there are abonos to create
        if (montoPagado > 0) {
          payments.push({
            id: 'pay-imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            nombre: String(nombre).trim(),
            monto: Math.round(montoPagado * 100) / 100,
            metodo: 'Importado de Excel',
            nota: 'Abono / Pago registrado en hoja de resumen',
            fecha: parseExcelDate(fechaRaw),
            saldoRestante: montoPendiente > 0 ? montoPendiente : 0
          });
        }

        // Create representative order(s) for the consumption
        const calculatedTotal = totalMonto > 0 ? totalMonto : (montoPendiente + montoPagado);
        if (calculatedTotal > 0 || productosDesglose) {
          const { items, totalQty } = parseProductsDescription(productosDesglose, calculatedTotal);
          const isPaid = (montoPendiente <= 0 && montoPagado > 0) || estadoVal.includes('pagado') || estadoVal.includes('al dia');

          orders.push({
            id: 'ord-imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            fecha: parseExcelDate(fechaRaw),
            nombre: String(nombre).trim(),
            telefono: telefono,
            producto: productosDesglose || `${totalProductos || totalQty || 1} producto(s)`,
            cantidad: totalProductos > 0 ? totalProductos : totalQty,
            items: items,
            monto: Math.round(calculatedTotal * 100) / 100,
            estadoPago: isPaid ? 'pagado' : 'pendiente',
            syncStatus: 'local',
            syncMessage: 'Importado desde archivo XLSX'
          });
        }
      }
      continue;
    }

    // Default / "Historial de Pedidos" / General row-by-row orders table
    for (const row of rows) {
      const nombre = getRowValue(row, ['nombre', 'comprador', 'cliente', 'persona', 'usuario']);
      if (!nombre) continue;

      const telefono = String(getRowValue(row, ['telefono', 'celular', 'tlf', 'whatsapp', 'phone']) || '').trim();
      const producto = String(getRowValue(row, ['producto', 'productos', 'articulo', 'descripcion', 'item']) || '').trim();
      const cantidad = parseInt(getRowValue(row, ['cantidad', 'cant', 'uds', 'unidades', 'qty']) || 1, 10);
      const montoVal = parseFloat(getRowValue(row, ['monto', 'total', 'precio', 'debe', 'valor', 'amount']) || 0);
      const fechaRaw = getRowValue(row, ['fecha', 'fechacompra', 'date', 'creado']);
      const horaRaw = getRowValue(row, ['hora', 'time']);
      const estadoRaw = String(getRowValue(row, ['estadopago', 'estado', 'status', 'pagado']) || '').toLowerCase();
      const abonoVal = parseFloat(getRowValue(row, ['abono', 'abonado', 'pago', 'yapagado']) || 0);
      const notas = String(getRowValue(row, ['notas', 'nota', 'observaciones', 'comentario']) || '').trim();

      const isPaid = estadoRaw === 'pagado' || estadoRaw === 'si' || estadoRaw === 'yes' || estadoRaw === 'al dia' || estadoRaw === 'true';

      const finalMonto = !isNaN(montoVal) && montoVal > 0 ? montoVal : 0;
      const { items, totalQty } = parseProductsDescription(producto, finalMonto);

      orders.push({
        id: 'ord-imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        fecha: parseExcelDate(fechaRaw, horaRaw),
        nombre: String(nombre).trim(),
        telefono: telefono,
        producto: producto || 'Consumo registrado',
        cantidad: cantidad > 0 ? cantidad : totalQty,
        items: items,
        monto: Math.round(finalMonto * 100) / 100,
        estadoPago: isPaid ? 'pagado' : 'pendiente',
        notas: notas,
        syncStatus: 'local',
        syncMessage: 'Importado desde archivo XLSX'
      });

      // If this row also explicitly lists an "Abono", register it
      if (!isNaN(abonoVal) && abonoVal > 0) {
        payments.push({
          id: 'pay-imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          nombre: String(nombre).trim(),
          monto: Math.round(abonoVal * 100) / 100,
          metodo: 'Abono Registrado en Excel',
          nota: `Abono de fila para ${producto || 'consumo'}`,
          fecha: parseExcelDate(fechaRaw, horaRaw),
          saldoRestante: Math.max(0, finalMonto - abonoVal)
        });
      }
    }
  }

  // Deduplicate orders if identical rows were parsed
  const uniqueOrders: OrderRecord[] = [];
  const seenOrderSignatures = new Set<string>();

  for (const o of orders) {
    const signature = `${o.nombre.toLowerCase().trim()}|${o.producto.toLowerCase().trim()}|${o.monto}|${o.fecha.slice(0, 10)}`;
    if (!seenOrderSignatures.has(signature)) {
      seenOrderSignatures.add(signature);
      uniqueOrders.push(o);
    }
  }

  // Deduplicate payments
  const uniquePayments: PaymentRecord[] = [];
  const seenPaymentSignatures = new Set<string>();
  for (const p of payments) {
    const sig = `${p.nombre.toLowerCase().trim()}|${p.monto}|${p.fecha.slice(0, 10)}`;
    if (!seenPaymentSignatures.has(sig)) {
      seenPaymentSignatures.add(sig);
      uniquePayments.push(p);
    }
  }

  // Build high-level summary grouped by buyer to display preview before confirming
  const buyersMap = new Map<string, {
    nombre: string;
    telefono: string;
    totalProductos: number;
    totalMonto: number;
    totalAbonado: number;
    productos: string[];
    cantidadItems: number;
  }>();

  for (const o of uniqueOrders) {
    const key = o.nombre.toLowerCase().trim();
    if (!buyersMap.has(key)) {
      buyersMap.set(key, {
        nombre: o.nombre.trim(),
        telefono: o.telefono || '',
        totalProductos: 0,
        totalMonto: 0,
        totalAbonado: 0,
        productos: [],
        cantidadItems: 0
      });
    }
    const b = buyersMap.get(key)!;
    if (!b.telefono && o.telefono) b.telefono = o.telefono;
    b.totalProductos += o.cantidad || 1;
    b.totalMonto += o.monto || 0;
    b.cantidadItems += 1;
    if (o.producto && !b.productos.includes(o.producto)) {
      b.productos.push(o.producto);
    }
    if (o.estadoPago === 'pagado') {
      b.totalAbonado += o.monto || 0;
    }
  }

  // Also include payment records in the buyer summary
  for (const p of uniquePayments) {
    const key = p.nombre.toLowerCase().trim();
    if (!buyersMap.has(key)) {
      buyersMap.set(key, {
        nombre: p.nombre.trim(),
        telefono: '',
        totalProductos: 0,
        totalMonto: 0,
        totalAbonado: 0,
        productos: ['Abono previo'],
        cantidadItems: 0
      });
    }
    const b = buyersMap.get(key)!;
    b.totalAbonado += p.monto;
  }

  const buyersSummary = Array.from(buyersMap.values()).map(b => {
    const saldoDebe = Math.max(0, Math.round((b.totalMonto - b.totalAbonado) * 100) / 100);
    return {
      ...b,
      totalMonto: Math.round(b.totalMonto * 100) / 100,
      totalAbonado: Math.round(b.totalAbonado * 100) / 100,
      saldoDebe,
      estado: (saldoDebe <= 0 && b.totalAbonado > 0 ? 'PAGADO' : 'PENDIENTE') as 'PAGADO' | 'PENDIENTE'
    };
  });

  let totalMonto = 0;
  let totalAbonado = 0;
  for (const b of buyersSummary) {
    totalMonto += b.totalMonto;
    totalAbonado += b.totalAbonado;
  }

  if (uniqueOrders.length === 0 && uniquePayments.length === 0) {
    warnings.push('No se detectaron filas válidas de clientes, consumos o abonos en las hojas del archivo.');
  }

  return {
    orders: uniqueOrders,
    payments: uniquePayments,
    buyersSummary,
    stats: {
      totalOrders: uniqueOrders.length,
      totalPayments: uniquePayments.length,
      totalUniqueBuyers: buyersSummary.length,
      totalMonto: Math.round(totalMonto * 100) / 100,
      totalAbonado: Math.round(totalAbonado * 100) / 100,
      totalDeuda: Math.round(Math.max(0, totalMonto - totalAbonado) * 100) / 100,
      sheetsFound
    },
    warnings
  };
}

/**
 * Recalcula el resumen por comprador y las estadísticas a partir de las listas
 * de pedidos y abonos. Se usa cuando el administrador EDITA la vista previa
 * antes de confirmar la importación, para que los totales queden siempre al día.
 */
export function recomputeImportSummary(
  orders: OrderRecord[],
  payments: PaymentRecord[],
  sheetsFound: string[] = [],
  warnings: string[] = []
): ParsedImportData {
  const buyersMap = new Map<string, {
    nombre: string;
    telefono: string;
    totalProductos: number;
    totalMonto: number;
    totalAbonado: number;
    productos: string[];
    cantidadItems: number;
  }>();

  for (const o of orders) {
    const key = o.nombre.toLowerCase().trim();
    if (!buyersMap.has(key)) {
      buyersMap.set(key, {
        nombre: o.nombre.trim(),
        telefono: o.telefono || '',
        totalProductos: 0,
        totalMonto: 0,
        totalAbonado: 0,
        productos: [],
        cantidadItems: 0
      });
    }
    const b = buyersMap.get(key)!;
    if (!b.telefono && o.telefono) b.telefono = o.telefono;
    b.totalProductos += o.cantidad || 1;
    b.totalMonto += o.monto || 0;
    b.cantidadItems += 1;
    if (o.producto && !b.productos.includes(o.producto)) {
      b.productos.push(o.producto);
    }
    if (o.estadoPago === 'pagado') {
      b.totalAbonado += o.monto || 0;
    }
  }

  for (const p of payments) {
    const key = p.nombre.toLowerCase().trim();
    if (!buyersMap.has(key)) {
      buyersMap.set(key, {
        nombre: p.nombre.trim(),
        telefono: '',
        totalProductos: 0,
        totalMonto: 0,
        totalAbonado: 0,
        productos: ['Abono previo'],
        cantidadItems: 0
      });
    }
    const b = buyersMap.get(key)!;
    b.totalAbonado += p.monto;
  }

  const buyersSummary = Array.from(buyersMap.values()).map(b => {
    const saldoDebe = Math.max(0, Math.round((b.totalMonto - b.totalAbonado) * 100) / 100);
    return {
      ...b,
      totalMonto: Math.round(b.totalMonto * 100) / 100,
      totalAbonado: Math.round(b.totalAbonado * 100) / 100,
      saldoDebe,
      estado: (saldoDebe <= 0 && b.totalAbonado > 0 ? 'PAGADO' : 'PENDIENTE') as 'PAGADO' | 'PENDIENTE'
    };
  });

  let totalMonto = 0;
  let totalAbonado = 0;
  for (const b of buyersSummary) {
    totalMonto += b.totalMonto;
    totalAbonado += b.totalAbonado;
  }

  return {
    orders,
    payments,
    buyersSummary,
    stats: {
      totalOrders: orders.length,
      totalPayments: payments.length,
      totalUniqueBuyers: buyersSummary.length,
      totalMonto: Math.round(totalMonto * 100) / 100,
      totalAbonado: Math.round(totalAbonado * 100) / 100,
      totalDeuda: Math.round(Math.max(0, totalMonto - totalAbonado) * 100) / 100,
      sheetsFound
    },
    warnings
  };
}

/**
 * Creates and downloads a sample XLSX template so the admin can fill it or see the format
 */
export function downloadSampleExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. Template sheet for direct orders
  const ordersTemplate = [
    {
      'Fecha': '10/10/2026',
      'Hora': '14:30',
      'Comprador': 'Carlos Pérez',
      'Teléfono': '04141234567',
      'Producto(s)': '2x MALTA, 1x FRUTON',
      'Cantidad': 3,
      'Monto': 2.70,
      'Estado Pago': 'PENDIENTE',
      'Abono': 1.00,
      'Notas': 'Abonó $1 en efectivo en el pasillo'
    },
    {
      'Fecha': '10/10/2026',
      'Hora': '15:15',
      'Comprador': 'María Gómez',
      'Teléfono': '04129876543',
      'Producto(s)': '1x GLU BOMBITA',
      'Cantidad': 1,
      'Monto': 0.50,
      'Estado Pago': 'PAGADO',
      'Abono': 0.50,
      'Notas': 'Pagó con Pago Móvil inmediato'
    },
    {
      'Fecha': '11/10/2026',
      'Hora': '09:00',
      'Comprador': 'Andrés Omaña',
      'Teléfono': '04140153904',
      'Producto(s)': 'COOL POWER',
      'Cantidad': 2,
      'Monto': 1.60,
      'Estado Pago': 'PENDIENTE',
      'Abono': 0,
      'Notas': 'Paga en quincena'
    }
  ];

  const wsOrders = XLSX.utils.json_to_sheet(ordersTemplate);
  wsOrders['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 16 },
    { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    { wch: 10 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Historial de Pedidos');

  // 2. Template sheet for buyers summary
  const summaryTemplate = [
    {
      'Nombre Comprador': 'Carlos Pérez',
      'Teléfono': '04141234567',
      'Total Productos': 3,
      'Total Acumulado ($)': 2.70,
      'Ya Pagado ($)': 1.00,
      'Por Pagar ($)': 1.70,
      'Estado': 'PENDIENTE DE PAGO',
      'Desglose de Consumo': '2x MALTA, 1x FRUTON'
    },
    {
      'Nombre Comprador': 'María Gómez',
      'Teléfono': '04129876543',
      'Total Productos': 1,
      'Total Acumulado ($)': 0.50,
      'Ya Pagado ($)': 0.50,
      'Por Pagar ($)': 0.00,
      'Estado': 'AL DÍA',
      'Desglose de Consumo': '1x GLU BOMBITA'
    }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryTemplate);
  wsSummary['!cols'] = [
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Compradores');

  XLSX.writeFile(wb, 'Plantilla_Carga_Kiosco.xlsx');
}
