/**
 * AEGENTIS Treasury — Coinbase Read-Only Integration
 * 
 * Read-only API key for portfolio monitoring and treasury reporting.
 * Credentials are loaded from environment variables — never hardcoded in source.
 * 
 * Setup:
 *   export COINBASE_API_KEY_ID="***REDACTED-ROTATE***"
 *   export COINBASE_API_SECRET="***REDACTED-ROTATE***"
 */

'use strict';

const crypto = require('crypto');
const EVENT_BUS_URL = process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent';

const API_KEY_ID = process.env.COINBASE_API_KEY_ID || '';
const API_SECRET = process.env.COINBASE_API_SECRET || '';
const API_BASE = 'https://api.coinbase.com';

function signRequest(method, path, body = '') {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;
  const signature = crypto.createHmac('sha256', API_SECRET).update(message).digest('hex');
  return { timestamp, signature };
}

async function coinbaseRequest(method, path, body = null) {
  if (!API_KEY_ID || !API_SECRET) {
    console.warn('[Coinbase] API credentials not set — set COINBASE_API_KEY_ID and COINBASE_API_SECRET');
    return null;
  }
  const bodyStr = body ? JSON.stringify(body) : '';
  const { timestamp, signature } = signRequest(method, path, bodyStr);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'CB-ACCESS-KEY': API_KEY_ID,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-VERSION': '2016-02-18',
      'Content-Type': 'application/json',
    },
    body: bodyStr || undefined,
  });
  if (!res.ok) {
    console.error(`[Coinbase] ${method} ${path} → ${res.status}`);
    return null;
  }
  return res.json();
}

async function getAccounts() {
  return coinbaseRequest('GET', '/v2/accounts');
}

async function getPortfolioSummary() {
  const accounts = await getAccounts();
  if (!accounts) return null;
  const summary = (accounts.data || []).map(a => ({
    name: a.name,
    currency: a.currency?.code,
    balance: a.balance?.amount,
    nativeBalance: a.native_balance?.amount,
  })).filter(a => parseFloat(a.balance) > 0);
  return { accounts: summary, timestamp: new Date().toISOString() };
}

async function emitTreasuryReport() {
  const summary = await getPortfolioSummary();
  if (!summary) return;
  try {
    await fetch(EVENT_BUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TREASURY_REPORT',
        source: 'coinbase-integration',
        payload: summary,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log('[Coinbase] Treasury report emitted to event bus');
  } catch (e) {
    console.warn('[Coinbase] Event bus emit failed:', e.message);
  }
}

module.exports = { coinbaseRequest, getAccounts, getPortfolioSummary, emitTreasuryReport };
