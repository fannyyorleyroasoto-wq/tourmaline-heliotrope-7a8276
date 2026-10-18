'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { WebpayPlus, Options, Environment, IntegrationApiKeys, IntegrationCommerceCodes } = require('transbank-sdk');
const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || '56936672794').replace(/\D/g, '');
const integration = process.env.USE_INTEGRATION !== 'false';
const commerceCode = process.env.TRANSBANK_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS;
const apiKey = process.env.TRANSBANK_API_KEY || IntegrationApiKeys.WEBPAY;
const tx = new WebpayPlus.Transaction(new Options(commerceCode, apiKey, integration ? Environment.Integration : Environment.Production));
// Precios del catálogo del servidor: nunca confiar en precios enviados por el navegador.
const PRODUCTS = { 1: 18500, 2: 21000, 3: 16900, 4: 8500, 5: 3200, 6: 2200 };
const pending = new Map();
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customer, delivery } = req.body || {};
    if (!customer || typeof customer.name !== 'string' || customer.name.trim().length < 2 || customer.name.length > 100) return res.status(400).json({ error: 'Ingresa tu nombre completo.' });
    if (!['domicilio', 'retiro'].includes(delivery)) return res.status(400).json({ error: 'Selecciona domicilio o retiro en tienda.' });
    if (delivery === 'domicilio' && (typeof customer.address !== 'string' || customer.address.trim().length < 5 || customer.address.length > 250)) return res.status(400).json({ error: 'Ingresa una dirección válida para el despacho.' });
    if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ error: 'El carrito está vacío o no es válido.' });
    let subtotal = 0; const cleanItems = [];
    for (const item of items) {
      const id = Number(item.id), qty = Number(item.qty);
      if (!PRODUCTS[id] || !Number.isInteger(qty) || qty < 1 || qty > 50) return res.status(400).json({ error: 'Hay un producto o cantidad no válida.' });
      subtotal += PRODUCTS[id] * qty; cleanItems.push({ id, qty });
    }
    const shipping = delivery === 'domicilio' ? 2500 : 0;
    const amount = subtotal + shipping;
    if (amount < 1 || amount > 99999999) return res.status(400).json({ error: 'El total del pedido no es válido.' });
    const buyOrder = ('DE' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex')).slice(0, 26);
    const sessionId = crypto.randomBytes(16).toString('hex');
    const response = await tx.create(buyOrder, sessionId, amount, `${BASE_URL}/webpay/return`);
    pending.set(response.token, { buyOrder, sessionId, amount, customer: { name: customer.name.trim(), address: delivery === 'domicilio' ? customer.address.trim() : 'Retiro en tienda' }, delivery, items: cleanItems, createdAt: Date.now() });
    res.json({ url: response.url, token: response.token });
  } catch (e) {
    console.error('No se pudo iniciar Webpay:', e.message);
    res.status(502).json({ error: 'No pudimos conectar con Webpay. Intenta nuevamente en unos minutos.' });
  }
});
app.all('/webpay/return', async (req, res) => {
  const token = req.body.token_ws || req.query.token_ws;
  const aborted = req.body.TBK_TOKEN || req.query.TBK_TOKEN;
  if (aborted || !token) return res.redirect('/?payment=cancelled');
  try {
    const order = pending.get(token);
    if (!order) return res.redirect('/?payment=unknown');
    const result = await tx.commit(token);
    const approved = result.status === 'AUTHORIZED' && result.response_code === 0 && Number(result.amount) === order.amount && result.buy_order === order.buyOrder;
    pending.delete(token);
    if (approved) {
      const summary = order.items.map(i => `${i.qty} x producto #${i.id}`).join(', ');
      const msg = `Hola, soy ${order.customer.name}. Mi pedido de Dulce Encanto fue pagado con Webpay. Pedido ${order.buyOrder}; ${summary}; entrega: ${order.customer.address}; total: $${order.amount.toLocaleString('es-CL')}.`;
      return res.redirect('/?payment=success&order=' + encodeURIComponent(order.buyOrder) + '&wa=' + encodeURIComponent(msg) + '&whatsapp=' + encodeURIComponent(WHATSAPP_NUMBER));
    }
    return res.redirect('/?payment=rejected');
  } catch (e) {
    console.error('No se pudo confirmar Webpay:', e.message);
    return res.redirect('/?payment=error');
  }
});
app.get('/health', (_req, res) => res.json({ ok: true, service: 'Dulce Encanto' }));
app.listen(PORT, () => console.log(`Dulce Encanto escuchando en puerto ${PORT}; Webpay ${integration ? 'integración' : 'producción'}`));
