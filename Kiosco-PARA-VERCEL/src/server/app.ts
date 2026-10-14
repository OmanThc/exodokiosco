import express from 'express';
import type { Request, Response } from 'express';
import { readStore, writeStore, backupStore } from './store';
import type { StoreData, ImportBatch } from './store';

// ============================================================
// App Express con TODAS las rutas /api/*
//  - Local / Docker / Fly: la arranca `server.ts` (Vite o estaticos)
//  - Vercel: la exporta como funcion serverless `api/index.ts`
// Este archivo NO abre puertos ni sirve archivos estaticos.
// ============================================================
export const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

function publicBatch(b: ImportBatch) {
  const { snapshotOrders, snapshotPayments, ...rest } = b;
  return { ...rest, hasSnapshot: !!(snapshotOrders || snapshotPayments) };
}

// GET all store data
app.get('/api/data', async (_req: Request, res: Response) => {
  try {
    const store = await readStore();
    res.json({
      success: true,
      orders: store.orders,
      products: store.products,
      payments: store.payments || [],
      settings: store.settings
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Error al leer los datos'
    });
  }
});

// POST new order
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { nombre, telefono, items, producto, cantidad, monto, notas, tipoPago, estadoPago } = req.body;

    if (!nombre || (!producto && (!items || items.length === 0))) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingresa tu nombre y al menos un producto.'
      });
    }

    const store = await readStore();
    const orderItems = Array.isArray(items) && items.length > 0
      ? items
      : [{ nombre: String(producto).trim(), cantidad: Number(cantidad) || 1, precio: Math.round((Number(monto) || 0) * 100) / 100 }];

    const newOrder: any = {
      id: 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      fecha: new Date().toISOString(),
      nombre: String(nombre).trim(),
      telefono: String(telefono || '').trim(),
      producto: String(producto || '').trim(),
      cantidad: Number(cantidad) || 1,
      items: orderItems,
      monto: Math.round((Number(monto) || 0) * 100) / 100,
      notas: String(notas || '').trim(),
      tipoPago: tipoPago === 'pagar_ahora' ? 'pagar_ahora' : 'pagar_quincena',
      estadoPago: estadoPago === 'pagado' ? 'pagado' : 'pendiente',
      syncStatus: 'pending',
      syncMessage: ''
    };

    // Deduct sold products from stockNevera automatically
    if (Array.isArray(store.products)) {
      store.products = store.products.map(prod => {
        const matchingItem = orderItems.find(
          (it: any) => it.nombre && it.nombre.toLowerCase().trim() === prod.nombre.toLowerCase().trim()
        );
        if (matchingItem) {
          const qty = Number(matchingItem.cantidad) || 1;
          const currentNevera = typeof prod.stockNevera === 'number' ? prod.stockNevera : 10;
          const newNevera = Math.max(0, currentNevera - qty);
          const currentDepo = typeof prod.stockDeposito === 'number' ? prod.stockDeposito : 20;
          return {
            ...prod,
            stockNevera: newNevera,
            stock: newNevera + currentDepo
          };
        }
        return prod;
      });
    }

    // Save locally first
    store.orders.unshift(newOrder);
    await writeStore(store);

    // If Google Apps Script is configured, attempt sync in background / directly
    if (store.settings.scriptUrl && store.settings.scriptUrl.startsWith('https://script.google.com/')) {
      try {
        const payload = {
          nombre: newOrder.nombre,
          telefono: newOrder.telefono,
          producto: newOrder.producto,
          cantidad: newOrder.cantidad,
          monto: newOrder.monto,
          fecha: newOrder.fecha,
          estado: newOrder.estadoPago
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const scriptRes = await fetch(store.settings.scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'follow',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const respText = await scriptRes.text();
        let parsed: any = null;
        try { parsed = JSON.parse(respText); } catch {}

        if (scriptRes.ok || (parsed && parsed.status === 'success')) {
          newOrder.syncStatus = 'synced';
          newOrder.syncMessage = 'Sincronizado con Google Sheets';
        } else {
          newOrder.syncStatus = 'failed';
          newOrder.syncMessage = (parsed && parsed.message) || respText.slice(0, 100) || 'Error al conectar';
        }
      } catch (syncErr: any) {
        newOrder.syncStatus = 'failed';
        newOrder.syncMessage = syncErr.message || 'Error de conexión';
      }

      // Update order status in store
      await writeStore(store);
    } else {
      newOrder.syncStatus = 'local';
      newOrder.syncMessage = 'Guardado en la base de datos local';
      await writeStore(store);
    }

    return res.status(201).json({
      success: true,
      order: newOrder
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error al registrar pedido'
    });
  }
});

// PATCH / PUT update order
app.put('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await readStore();
    const index = store.orders.findIndex(o => o.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    store.orders[index] = { ...store.orders[index], ...req.body };
    await writeStore(store);

    return res.json({ success: true, order: store.orders[index] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Bulk settle orders (mark as paid for a buyer or selected IDs)
app.post('/api/orders/bulk-settle', async (req: Request, res: Response) => {
  try {
    const { orderIds, buyerName, estadoPago = 'pagado' } = req.body;
    const store = await readStore();
    let updatedCount = 0;

    store.orders = store.orders.map(order => {
      const matchId = Array.isArray(orderIds) && orderIds.includes(order.id);
      const matchBuyer = buyerName && order.nombre.toLowerCase().trim() === buyerName.toLowerCase().trim();

      if (matchId || matchBuyer) {
        updatedCount++;
        return {
          ...order,
          estadoPago,
          fechaPago: estadoPago === 'pagado' ? new Date().toISOString() : undefined
        };
      }
      return order;
    });

    await writeStore(store);
    return res.json({ success: true, updatedCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST new payment record (quién me pagó)
app.post('/api/payments', async (req: Request, res: Response) => {
  try {
    const { nombre, monto, metodo, nota, fecha, saldoRestante } = req.body;
    if (!nombre || !monto || Number(monto) <= 0) {
      return res.status(400).json({ success: false, message: 'Nombre y monto son requeridos.' });
    }

    const store = await readStore();
    const cleanMonto = Math.round(Number(monto) * 100) / 100;
    const cleanSaldo = typeof saldoRestante === 'number'
      ? Math.round(saldoRestante * 100) / 100
      : undefined;

    const newPayment = {
      id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      fecha: fecha || new Date().toISOString(),
      nombre: String(nombre).trim(),
      monto: cleanMonto,
      metodo: String(metodo || 'Pago Móvil').trim(),
      nota: String(nota || '').trim(),
      saldoRestante: cleanSaldo
    };

    if (!Array.isArray(store.payments)) {
      store.payments = [];
    }

    store.payments.unshift(newPayment);
    await writeStore(store);

    return res.status(201).json({ success: true, payment: newPayment });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE payment record
app.delete('/api/payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await readStore();
    if (Array.isArray(store.payments)) {
      store.payments = store.payments.filter(p => p.id !== id);
      await writeStore(store);
    }
    return res.json({ success: true, message: 'Pago eliminado correctamente' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE order
app.delete('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await readStore();
    const prevLen = store.orders.length;
    store.orders = store.orders.filter(o => o.id !== id);

    if (store.orders.length === prevLen) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    await writeStore(store);
    return res.json({ success: true, message: 'Pedido eliminado' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST save products catalog
app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: 'Formato de productos inválido' });
    }

    const store = await readStore();
    store.products = products;
    await writeStore(store);

    return res.json({ success: true, products: store.products });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST update product inventory (stockNevera, stockDeposito)
app.post('/api/products/inventory', async (req: Request, res: Response) => {
  try {
    const { productId, stockNevera, stockDeposito } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'ID del producto requerido' });
    }

    const store = await readStore();
    let updated = false;
    store.products = store.products.map(p => {
      if (p.id === productId) {
        updated = true;
        const sNevera = Math.max(0, Number(stockNevera) || 0);
        const sDepo = Math.max(0, Number(stockDeposito) || 0);
        return {
          ...p,
          stockNevera: sNevera,
          stockDeposito: sDepo,
          stock: sNevera + sDepo
        };
      }
      return p;
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    await writeStore(store);
    return res.json({ success: true, products: store.products });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST save settings
app.post('/api/settings', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Configuración inválida' });
    }

    const store = await readStore();
    store.settings = { ...store.settings, ...settings };
    await writeStore(store);

    return res.json({ success: true, settings: store.settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST bulk import orders and payments from XLSX
app.post('/api/import-data', async (req: Request, res: Response) => {
  try {
    const { orders: newOrders, payments: newPayments, replaceMode, fileName } = req.body;

    const store = await readStore();
    if (!Array.isArray(store.imports)) store.imports = [];

    const previousOrders = store.orders;
    const previousPayments = Array.isArray(store.payments) ? store.payments : [];

    const batch: ImportBatch = {
      id: 'imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      fecha: new Date().toISOString(),
      fileName: fileName ? String(fileName) : undefined,
      replaceMode: !!replaceMode,
      ordersAdded: 0,
      paymentsAdded: 0,
      addedOrderIds: [],
      addedPaymentIds: []
    };

    if (replaceMode) {
      const ordersArr = Array.isArray(newOrders) ? newOrders : [];
      const paymentsArr = Array.isArray(newPayments) ? newPayments : [];
      store.orders = ordersArr;
      store.payments = paymentsArr;
      batch.ordersAdded = ordersArr.length;
      batch.paymentsAdded = paymentsArr.length;
      batch.addedOrderIds = ordersArr.map((o: any) => o.id).filter(Boolean);
      batch.addedPaymentIds = paymentsArr.map((p: any) => p.id).filter(Boolean);
      // Guardamos copia de lo que había antes para poder restaurarlo al deshacer
      batch.snapshotOrders = previousOrders;
      batch.snapshotPayments = previousPayments;
    } else {
      // Merge mode: append without duplicates
      if (Array.isArray(newOrders) && newOrders.length > 0) {
        const existingOrderIds = new Set(store.orders.map(o => o.id));
        const toAdd = newOrders.filter(o => !existingOrderIds.has(o.id));
        store.orders = [...toAdd, ...store.orders];
        batch.ordersAdded = toAdd.length;
        batch.addedOrderIds = toAdd.map((o: any) => o.id).filter(Boolean);
      }
      if (Array.isArray(newPayments) && newPayments.length > 0) {
        if (!Array.isArray(store.payments)) store.payments = [];
        const existingPaymentIds = new Set(store.payments.map(p => p.id));
        const toAddPay = newPayments.filter(p => !existingPaymentIds.has(p.id));
        store.payments = [...toAddPay, ...store.payments];
        batch.paymentsAdded = toAddPay.length;
        batch.addedPaymentIds = toAddPay.map((p: any) => p.id).filter(Boolean);
      }
    }

    store.imports.unshift(batch);
    // Guardamos solo las últimas 50 importaciones
    if (store.imports.length > 50) store.imports = store.imports.slice(0, 50);

    await writeStore(store);

    return res.json({
      success: true,
      message: 'Datos importados y guardados con éxito',
      batch: publicBatch(batch),
      imports: store.imports.map(publicBatch),
      ordersCount: store.orders.length,
      paymentsCount: (store.payments || []).length,
      orders: store.orders,
      payments: store.payments || []
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error al importar datos' });
  }
});

// GET listado de importaciones (para poder deshacer)
app.get('/api/imports', async (_req: Request, res: Response) => {
  try {
    const store = await readStore();
    return res.json({
      success: true,
      imports: (store.imports || []).map(publicBatch)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error al obtener importaciones' });
  }
});

// POST deshacer una importación: elimina los datos que ese archivo agregó
app.post('/api/imports/:id/undo', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    // Por defecto se quitan ambos; el cliente puede pedir solo uno
    const removeOrders = body.removeOrders !== false;
    const removePayments = body.removePayments !== false;

    if (!removeOrders && !removePayments) {
      return res.status(400).json({ success: false, message: 'Selecciona al menos qué quieres quitar (pedidos o abonos).' });
    }

    const store = await readStore();
    const batch = (store.imports || []).find(b => b.id === id);

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Importación no encontrada (puede que ya se haya eliminado).' });
    }

    let removedOrders = 0;
    let removedPayments = 0;

    if (batch.replaceMode && (Array.isArray(batch.snapshotOrders) || Array.isArray(batch.snapshotPayments))) {
      // Modo reemplazar: restauramos lo que existía antes de la importación
      if (removeOrders && Array.isArray(batch.snapshotOrders)) {
        removedOrders = store.orders.length;
        store.orders = batch.snapshotOrders;
        batch.snapshotOrders = undefined;
      }
      if (removePayments && Array.isArray(batch.snapshotPayments)) {
        removedPayments = (store.payments || []).length;
        store.payments = batch.snapshotPayments;
        batch.snapshotPayments = undefined;
      }
    } else {
      // Modo combinar: quitamos exactamente los registros que se agregaron
      if (removeOrders) {
        const orderIds = new Set(batch.addedOrderIds || []);
        const beforeOrders = store.orders.length;
        store.orders = store.orders.filter(o => !orderIds.has(o.id));
        removedOrders = beforeOrders - store.orders.length;
        batch.addedOrderIds = [];
        batch.ordersAdded = 0;
      }
      if (removePayments && Array.isArray(store.payments)) {
        const paymentIds = new Set(batch.addedPaymentIds || []);
        const beforePayments = store.payments.length;
        store.payments = store.payments.filter(p => !paymentIds.has(p.id));
        removedPayments = beforePayments - store.payments.length;
        batch.addedPaymentIds = [];
        batch.paymentsAdded = 0;
      }
    }

    // Si ya no queda nada pendiente por deshacer, borramos el lote.
    // Si el usuario quiso quitar solo una parte, conservamos el lote para poder quitar el resto después.
    const nothingLeft = !batch.ordersAdded && !batch.paymentsAdded && !batch.snapshotOrders && !batch.snapshotPayments;
    if (nothingLeft) {
      store.imports = (store.imports || []).filter(b => b.id !== id);
    } else {
      store.imports = (store.imports || []).map(b => (b.id === id ? batch : b));
    }

    await writeStore(store);

    return res.json({
      success: true,
      message: `Se quitaron ${removedOrders} pedido(s) y ${removedPayments} abono(s).`,
      removedOrders,
      removedPayments,
      orders: store.orders,
      payments: store.payments || [],
      imports: store.imports.map(publicBatch)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error al deshacer la importación' });
  }
});

// POST reiniciar: borra TODO el historial de ventas (pedidos y deudas) y los abonos/pagos.
// Antes de borrar guarda un respaldo con marca de tiempo (recuperable).
app.post('/api/reset-data', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const clearOrders = body.clearOrders !== false;      // por defecto sí
    const clearPayments = body.clearPayments !== false;  // por defecto sí

    if (!clearOrders && !clearPayments) {
      return res.status(400).json({ success: false, message: 'Selecciona al menos qué quieres borrar (ventas/deudas o abonos).' });
    }

    const store = await readStore();
    const removedOrders = clearOrders ? store.orders.length : 0;
    const removedPayments = clearPayments ? (store.payments || []).length : 0;

    // Respaldo con marca de tiempo para poder recuperar (no se sobrescribe)
    await backupStore(store);

    const next: StoreData = {
      ...store,
      orders: clearOrders ? [] : store.orders,
      payments: clearPayments ? [] : (store.payments || []),
      // El historial de importaciones también es parte del historial: se limpia
      imports: []
    };
    await writeStore(next);

    return res.json({
      success: true,
      message: `Se borraron ${removedOrders} pedido(s)/deuda(s) y ${removedPayments} abono(s)/pago(s).`,
      removedOrders,
      removedPayments,
      orders: next.orders,
      payments: next.payments,
      imports: []
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error al borrar el historial' });
  }
});

// Existing proxy endpoint for Google Apps Script doPost
app.post('/api/sync-order', async (req: Request, res: Response) => {
  try {
    const { scriptUrl, data } = req.body;

    if (!data || !data.nombre || !data.producto) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios (nombre, producto).'
      });
    }

    if (!scriptUrl || typeof scriptUrl !== 'string' || !scriptUrl.startsWith('https://script.google.com/')) {
      return res.status(400).json({
        success: false,
        message: 'La URL proporcionada no es válida (debe comenzar con https://script.google.com/).'
      });
    }

    const payload = {
      nombre: String(data.nombre || '').trim(),
      telefono: String(data.telefono || '').trim(),
      producto: String(data.producto || '').trim(),
      cantidad: Number(data.cantidad) || 1,
      monto: Number(data.monto) || 0,
      fecha: data.fecha || new Date().toISOString(),
      estado: data.estado || 'Pendiente'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const scriptResponse = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await scriptResponse.text();
    let responseJson: any = null;

    try {
      responseJson = JSON.parse(responseText);
    } catch {
      if (responseText.includes('accounts.google.com') || responseText.includes('<html')) {
        return res.status(401).json({
          success: false,
          message: 'Error de permisos en Google Apps Script: Asegúrate de configurar "¿Quién tiene acceso? -> Cualquier usuario (Anyone)".',
          raw: responseText.slice(0, 300)
        });
      }
    }

    if (responseJson && responseJson.status === 'success') {
      return res.json({
        success: true,
        message: responseJson.message || 'Guardado con éxito en Google Sheets',
        payloadSent: payload,
        response: responseJson
      });
    } else if (responseJson && responseJson.status === 'error') {
      return res.status(400).json({
        success: false,
        message: `Google Apps Script reportó un error: ${responseJson.message}`,
        response: responseJson
      });
    }

    if (scriptResponse.ok) {
      return res.json({
        success: true,
        message: 'Respuesta recibida de Google Apps Script',
        raw: responseText.slice(0, 200)
      });
    }

    return res.status(502).json({
      success: false,
      message: `Error al contactar Google Apps Script (HTTP ${scriptResponse.status})`,
      raw: responseText.slice(0, 300)
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        message: 'Tiempo de espera agotado al conectar con Google Apps Script.'
      });
    }
    return res.status(500).json({
      success: false,
      message: `Error al procesar la solicitud: ${error?.message || error}`
    });
  }
});

// API Endpoint to test the script connection
app.post('/api/test-connection', async (req: Request, res: Response) => {
  try {
    const { scriptUrl, isSimulated } = req.body;

    if (isSimulated) {
      return res.json({
        success: true,
        message: 'Modo simulador activo. Las ventas se registran localmente.'
      });
    }

    if (!scriptUrl || typeof scriptUrl !== 'string' || !scriptUrl.startsWith('https://script.google.com/')) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa una URL válida de Google Apps Script (https://script.google.com/macros/s/.../exec).'
      });
    }

    const testPayload = {
      nombre: 'Prueba de Conexión NFC',
      telefono: '+52 000 000 0000',
      producto: 'Test SheetSync',
      cantidad: 1,
      monto: 0,
      fecha: new Date().toISOString(),
      estado: 'Prueba'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const scriptResponse = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const text = await scriptResponse.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
        return res.status(403).json({
          success: false,
          message: 'Error de permisos: Asegúrate de que "¿Quién tiene acceso?" esté configurado en "Cualquier usuario" (Anyone).'
        });
      }
    }

    if (json && json.status === 'success') {
      return res.json({
        success: true,
        message: '¡Conexión exitosa! El script respondió correctamente y se insertó la fila de prueba en tu hoja.',
        response: json
      });
    }

    return res.json({
      success: true,
      message: 'Conexión alcanzada. Respuesta del script: ' + (json?.message || text.slice(0, 150))
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: `Error al probar conexión: ${error?.message || error}`
    });
  }
});

export default app;
