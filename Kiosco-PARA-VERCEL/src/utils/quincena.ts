import { BuyerSummary, OrderRecord, PaymentRecord } from '../types';

export interface QuincenaOption {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

export function getCurrentQuincena(): { period: 1 | 2; month: number; year: number } {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  return {
    period: day <= 15 ? 1 : 2,
    month,
    year
  };
}

export function getQuincenaOptions(): QuincenaOption[] {
  const options: QuincenaOption[] = [];
  const now = new Date();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Generate last 6 quincenas
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setMonth(d.getMonth() - Math.floor(i / 2));
    const year = d.getFullYear();
    const month = d.getMonth();
    
    let qNum = 1;
    if (i === 0) {
      qNum = now.getDate() <= 15 ? 1 : 2;
    } else {
      const currentQ = now.getDate() <= 15 ? 1 : 2;
      const totalHalvesBack = i;
      const targetHalf = currentQ - totalHalvesBack;
      const targetMonthOffset = Math.floor((targetHalf - 1) / 2);
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + targetMonthOffset, 1);
      const targetIsQ1 = ((targetHalf % 2) + 2) % 2 === 1;
      
      const lastDayOfTargetMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();
      const start = targetIsQ1
        ? new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1, 0, 0, 0)
        : new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 16, 0, 0, 0);
      const end = targetIsQ1
        ? new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 15, 23, 59, 59)
        : new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), lastDayOfTargetMonth, 23, 59, 59);

      options.push({
        id: `q-${targetMonthDate.getFullYear()}-${targetMonthDate.getMonth() + 1}-${targetIsQ1 ? 1 : 2}`,
        label: `${targetIsQ1 ? '1ª' : '2ª'} Quincena ${monthNames[targetMonthDate.getMonth()]} ${targetMonthDate.getFullYear()}`,
        startDate: start,
        endDate: end
      });
      continue;
    }

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const start = qNum === 1
      ? new Date(year, month, 1, 0, 0, 0)
      : new Date(year, month, 16, 0, 0, 0);
    const end = qNum === 1
      ? new Date(year, month, 15, 23, 59, 59)
      : new Date(year, month, lastDayOfMonth, 23, 59, 59);

    options.push({
      id: `q-${year}-${month + 1}-${qNum}`,
      label: `${qNum === 1 ? '1ª' : '2ª'} Quincena ${monthNames[month]} ${year} (Actual)`,
      startDate: start,
      endDate: end
    });
  }

  const seen = new Set<string>();
  return options.filter(opt => {
    if (seen.has(opt.id)) return false;
    seen.add(opt.id);
    return true;
  });
}

export function filterOrdersByDate(orders: OrderRecord[], startDate?: Date, endDate?: Date): OrderRecord[] {
  if (!startDate || !endDate) return orders;
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  return orders.filter(o => {
    const oMs = new Date(o.fecha).getTime();
    return oMs >= startMs && oMs <= endMs;
  });
}

export function groupOrdersByBuyer(orders: OrderRecord[], payments: PaymentRecord[] = []): BuyerSummary[] {
  const buyersMap = new Map<string, BuyerSummary>();

  for (const order of orders) {
    const key = order.nombre.toLowerCase().trim();
    if (!key) continue;

    let buyer = buyersMap.get(key);
    if (!buyer) {
      buyer = {
        nombre: order.nombre.trim(),
        telefono: order.telefono || '',
        totalMonto: 0,
        montoPendiente: 0,
        montoPagado: 0,
        totalProductos: 0,
        ordenes: [],
        pagos: [],
        productosDesglose: {},
        ultimaCompra: order.fecha,
        estadoGeneral: 'al_dia'
      };
      buyersMap.set(key, buyer);
    }

    if (order.telefono && !buyer.telefono) {
      buyer.telefono = order.telefono;
    }

    buyer.ordenes.push(order);
    buyer.totalMonto += order.monto || 0;
    buyer.totalProductos += order.cantidad || 1;

    // Latest date
    if (new Date(order.fecha) > new Date(buyer.ultimaCompra)) {
      buyer.ultimaCompra = order.fecha;
    }

    // Breakdown
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const itemKey = item.nombre.trim();
        if (!buyer.productosDesglose[itemKey]) {
          buyer.productosDesglose[itemKey] = {
            cantidad: 0,
            total: 0,
            precioUnitario: item.precio || 0,
            emoji: item.emoji,
            imagenUrl: item.imagenUrl
          };
        }
        buyer.productosDesglose[itemKey].cantidad += item.cantidad || 1;
        buyer.productosDesglose[itemKey].total += (item.precio || 0) * (item.cantidad || 1);
        if (item.emoji && !buyer.productosDesglose[itemKey].emoji) buyer.productosDesglose[itemKey].emoji = item.emoji;
        if (item.imagenUrl && !buyer.productosDesglose[itemKey].imagenUrl) buyer.productosDesglose[itemKey].imagenUrl = item.imagenUrl;
      }
    } else {
      const prodKey = order.producto.trim() || 'Varios';
      if (!buyer.productosDesglose[prodKey]) {
        buyer.productosDesglose[prodKey] = {
          cantidad: 0,
          total: 0,
          precioUnitario: order.monto / (order.cantidad || 1)
        };
      }
      buyer.productosDesglose[prodKey].cantidad += order.cantidad || 1;
      buyer.productosDesglose[prodKey].total += order.monto || 0;
    }
  }

  // Also include buyers that may have made a payment even if filtered
  for (const pay of payments) {
    const key = pay.nombre.toLowerCase().trim();
    if (!key) continue;
    let buyer = buyersMap.get(key);
    if (!buyer) {
      buyer = {
        nombre: pay.nombre.trim(),
        telefono: '',
        totalMonto: 0,
        montoPendiente: 0,
        montoPagado: 0,
        totalProductos: 0,
        ordenes: [],
        pagos: [],
        productosDesglose: {},
        ultimaCompra: pay.fecha,
        estadoGeneral: 'al_dia'
      };
      buyersMap.set(key, buyer);
    }
    buyer.pagos.push(pay);
  }

  const result = Array.from(buyersMap.values());
  for (const b of result) {
    const key = b.nombre.toLowerCase().trim();
    // Associate matching payments and sort chronologically (most recent first)
    b.pagos = payments
      .filter(p => p.nombre.toLowerCase().trim() === key)
      .sort((p1, p2) => new Date(p2.fecha).getTime() - new Date(p1.fecha).getTime());

    const sumAbonos = b.pagos.reduce((acc, p) => acc + (p.monto || 0), 0);
    const sumDirectOrdersPaid = b.ordenes
      .filter(o => o.estadoPago === 'pagado')
      .reduce((acc, o) => acc + (o.monto || 0), 0);

    b.totalMonto = Math.round(b.totalMonto * 100) / 100;
    // Paid is max between direct orders marked paid and explicit payments recorded
    b.montoPagado = Math.round(Math.max(sumDirectOrdersPaid, sumAbonos) * 100) / 100;
    // What is still owed ("que me falta por pagar")
    b.montoPendiente = Math.round(Math.max(0, b.totalMonto - b.montoPagado) * 100) / 100;

    for (const itemKey of Object.keys(b.productosDesglose)) {
      b.productosDesglose[itemKey].total = Math.round(b.productosDesglose[itemKey].total * 100) / 100;
    }

    b.estadoGeneral = b.montoPendiente > 0 ? 'deudor' : 'al_dia';
  }

  // Sort: highest pending debt first, then total amount
  result.sort((a, b) => b.montoPendiente - a.montoPendiente || b.totalMonto - a.totalMonto);

  return result;
}

export function generateWhatsAppMessage(
  buyer: BuyerSummary,
  periodLabel: string,
  currency: string = '$',
  paymentInfo: string = '',
  businessName: string = 'Kiosco de Confianza'
): string {
  const breakdownLines = Object.entries(buyer.productosDesglose)
    .map(([prod, info]) => `• ${info.cantidad}x ${prod} (${currency}${info.total.toFixed(2)})`)
    .join('\n');

  let text = `🧾 *ESTADO DE CUENTA - ${businessName.toUpperCase()}*\n`;
  text += `👤 *Cliente:* ${buyer.nombre}\n`;
  text += `📅 *Periodo:* ${periodLabel}\n\n`;

  if (breakdownLines) {
    text += `🛒 *DETALLE DE LO CONSUMIDO:*\n${breakdownLines}\n\n`;
  }

  text += `---------------------------------\n`;
  text += `💵 *Total consumido:* ${currency}${buyer.totalMonto.toFixed(2)}\n`;

  if (buyer.montoPagado > 0) {
    text += `✅ *Total ya abonado/pagado:* ${currency}${buyer.montoPagado.toFixed(2)}\n`;
    if (buyer.pagos && buyer.pagos.length > 0) {
      text += `📝 *Historial de Abonos Recibidos:*\n`;
      buyer.pagos.forEach(p => {
        const pDate = new Date(p.fecha);
        const fechaStr = `${pDate.toLocaleDateString()} ${pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const restanteStr = typeof p.saldoRestante === 'number' ? ` -> le restó: ${currency}${p.saldoRestante.toFixed(2)}` : '';
        text += `   • +${currency}${p.monto.toFixed(2)} (${p.metodo} - ${fechaStr})${restanteStr}\n`;
      });
      text += `\n`;
    }
  }

  if (buyer.montoPendiente > 0) {
    text += `🔴 *CUÁNTO LE QUEDA POR PAGAR: ${currency}${buyer.montoPendiente.toFixed(2)}*\n`;
  } else {
    text += `🟢 *ESTADO:* ¡Cuenta 100% liquidada! ($0.00 pendiente)\n`;
  }
  text += `---------------------------------\n\n`;

  if (buyer.montoPendiente > 0 && paymentInfo) {
    text += `💳 *Datos para transferir / Pago Móvil:*\n${paymentInfo}\n\n`;
    text += `Por favor envíame el comprobante al realizar el pago para asentar tu cuenta. ¡Muchas gracias! 😊`;
  } else {
    text += `¡Muchas gracias por tu pago y preferencia! ¡Que tengas un excelente día! 😊`;
  }

  return text;
}
