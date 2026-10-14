import * as XLSX from 'xlsx';
import { BuyerSummary, OrderRecord } from '../types';

export function exportOrdersToExcel(
  orders: OrderRecord[],
  buyers: BuyerSummary[],
  quincenaTitle: string = 'Quincena Actual',
  currency: string = '$'
) {
  // Workbook creation
  const wb = XLSX.utils.book_new();

  // 1. Resumen por Comprador
  const buyersData = buyers.map((b, idx) => {
    // Generate readable products list
    const itemsSummary = Object.entries(b.productosDesglose)
      .map(([prod, info]) => `${info.cantidad}x ${prod} (${currency}${info.total.toFixed(2)})`)
      .join(', ');

    return {
      '#': idx + 1,
      'Nombre Comprador': b.nombre,
      'Teléfono': b.telefono || 'Sin teléfono',
      'Total Productos': b.totalProductos,
      [`Por Pagar (${currency})`]: Number(b.montoPendiente.toFixed(2)),
      [`Ya Pagado (${currency})`]: Number(b.montoPagado.toFixed(2)),
      [`Total Acumulado (${currency})`]: Number(b.totalMonto.toFixed(2)),
      'Estado': b.montoPendiente > 0 ? 'PENDIENTE DE PAGO' : 'AL DÍA',
      'Desglose de Consumo': itemsSummary,
      'Último Registro': b.ultimaCompra ? new Date(b.ultimaCompra).toLocaleDateString() : '-'
    };
  });

  const wsBuyers = XLSX.utils.json_to_sheet(buyersData);
  // Auto column widths
  wsBuyers['!cols'] = [
    { wch: 5 },
    { wch: 25 },
    { wch: 18 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 45 },
    { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, wsBuyers, 'Resumen Compradores');

  // 2. Detalle de todas las órdenes
  const ordersData = orders.map((o, idx) => {
    const d = new Date(o.fecha);
    const fecha = d.toLocaleDateString();
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      'N°': idx + 1,
      'Fecha': fecha,
      'Hora': hora,
      'Nombre': o.nombre,
      'Teléfono': o.telefono || '-',
      'Producto(s)': o.producto,
      'Cantidad': o.cantidad || 1,
      [`Monto (${currency})`]: Number((Number(o.monto) || 0).toFixed(2)),
      'Estado Pago': o.estadoPago === 'pagado' ? 'PAGADO' : 'PENDIENTE',
      'Fecha Pago': o.fechaPago ? new Date(o.fechaPago).toLocaleDateString() : '-',
      'Sincronizado Sheet': o.syncStatus === 'synced' ? 'SÍ' : o.syncStatus === 'local' ? 'LOCAL' : 'PENDIENTE',
      'Notas': o.notas || ''
    };
  });

  const wsOrders = XLSX.utils.json_to_sheet(ordersData);
  wsOrders['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 10 },
    { wch: 25 },
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 14 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Historial de Pedidos');

  // Clean title for file name
  const safeTitle = quincenaTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `Cierre_${safeTitle}_${dateStamp}.xlsx`;

  // Write and trigger browser download
  XLSX.writeFile(wb, filename);
}
