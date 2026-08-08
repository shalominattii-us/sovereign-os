/**
 * AEGENTIS-X Shopify Store Integration
 * Store: aegentis-x (admin.shopify.com/store/aegentis-x)
 * 
 * Provides autonomous store operations for the TREASURY division:
 * - Product catalog sync
 * - Order monitoring
 * - Revenue reporting to event bus
 */

'use strict';

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'aegentis-x.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const EVENT_BUS_URL = process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent';

// ── Product Catalog (as of 2026-07-08) ─────────────────────────────────────
const PRODUCT_CATALOG = [
  // AEGENTIS-X Core Products
  { id: '8422023233606', name: 'AEGENTIS Core — AI Development Platform', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  { id: '8422023331910', name: 'AEGENTIS Pro — Complete AI Solution', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  { id: '8422023495750', name: 'AEGENTIS-X Enterprise — Cybernetic Intelligence Platform', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  { id: '8422023725126', name: 'AEGENTIS Infinite — Custom AI Solutions', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  { id: '8422024282182', name: 'AI Implementation Workshop', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  { id: '8422024544326', name: 'Cybernetic Intelligence Masterclass', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  // AEGENTIX CYBERNETICS Products
  { id: '8452509958214', name: 'AEGENTIS Robotics — Autonomous Robotics Control Suite', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510351430', name: 'AEGENTIS-X — VR Agentic AI Commander', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510384198', name: 'AEGENTIS Security — Orbital Observer Monitoring Suite', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510416966', name: 'AEGENTIS Data — Vector Memory & Knowledge Graph', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510449734', name: 'AEGENTIS Cloud — Real-Time Event Streaming', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510580806', name: 'AEGENTIS Treasury — Sovereign Wallet & Asset Registry', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510646342', name: 'SOVEREIGN OS — Node Infrastructure Package', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  { id: '8452510711878', name: 'AEGENTIS Multi-LLM Runtime — AI Model Orchestration', vendor: 'AEGENTIX CYBERNETICS', status: 'ACTIVE' },
  // Trading Products
  { id: '8422107840582', name: 'AEGENTIS Trading Core — Autonomous Trading Engine', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
  { id: '8422108135494', name: 'AEGENTIS Trading Pro — Advanced Autonomous Trading', vendor: 'AEGENTIS-X', status: 'ACTIVE' },
];

async function shopifyRequest(endpoint, method = 'GET', body = null) {
  if (!ACCESS_TOKEN) {
    console.warn('[Shopify] No access token configured — set SHOPIFY_ACCESS_TOKEN');
    return null;
  }
  const url = `https://${STORE_DOMAIN}/admin/api/2024-01/${endpoint}`;
  const opts = {
    method,
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    console.error(`[Shopify] ${method} ${endpoint} → ${res.status}`);
    return null;
  }
  return res.json();
}

async function emitToEventBus(event) {
  try {
    await fetch(EVENT_BUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'SHOPIFY_EVENT',
        source: 'aegentis-x-store',
        payload: event,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn('[Shopify] Event bus emit failed:', e.message);
  }
}

async function syncOrders() {
  const data = await shopifyRequest('orders.json?status=any&limit=50');
  if (!data) return [];
  const orders = data.orders || [];
  console.log(`[Shopify] Synced ${orders.length} orders`);
  if (orders.length > 0) {
    await emitToEventBus({ type: 'ORDER_SYNC', count: orders.length, orders: orders.map(o => ({
      id: o.id, name: o.name, total: o.total_price, status: o.financial_status, created: o.created_at
    }))});
  }
  return orders;
}

async function getStoreInfo() {
  return {
    domain: STORE_DOMAIN,
    adminUrl: 'https://admin.shopify.com/store/aegentis-x',
    productCount: PRODUCT_CATALOG.length,
    products: PRODUCT_CATALOG,
    lastSync: new Date().toISOString(),
  };
}

module.exports = { shopifyRequest, syncOrders, getStoreInfo, PRODUCT_CATALOG, emitToEventBus };
