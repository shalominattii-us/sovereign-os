/**
 * AEGENTIS CORPORATION — Wallet v2 REST Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes the WalletV2Runtime over HTTP.
 *
 * Endpoints (all relative to /v2):
 *   POST   /wallets                            – create wallet
 *   GET    /wallets/:walletId                  – get wallet metadata
 *   POST   /wallets/:walletId/deposit          – deposit asset
 *   POST   /wallets/:walletId/withdraw         – initiate withdrawal
 *   POST   /wallets/:walletId/transfer         – transfer to another wallet
 *   GET    /wallets/:walletId/balance          – current balance
 *   POST   /wallets/:walletId/snapshot         – emit balance snapshot to Kernel
 *   GET    /wallets/:walletId/history          – ledger history
 *   POST   /transactions/:txId/sign            – sign pending tx
 *   POST   /transactions/:txId/reject          – reject pending tx
 *   GET    /transactions/:txId                 – get pending tx
 *   GET    /assets                             – list assets
 *   POST   /assets                             – register asset
 *   GET    /health                             – service health
 *
 * Version: 2.0.0
 * Port:    8083 (override with WALLET_V2_PORT)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express  = require('express');
const wallet   = require('./wallet_v2');
const registry = require('../asset-registry/registry');
const ledger   = require('../treasury-ledger/ledger');

const app  = express();
const PORT = process.env.WALLET_V2_PORT || 8083;

app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[WALLET-V2] ${req.method} ${req.path}`);
  next();
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service:              'AEGENTIS-WALLET-V2',
    version:              '2.0.0',
    wallets:              wallet.wallets.size,
    pending_transactions: wallet.pendingTransactions.size,
    assets:               registry.list().length,
    timestamp:            new Date().toISOString()
  });
});

// ── Wallets ───────────────────────────────────────────────────────────────────
app.post('/v2/wallets', async (req, res) => {
  const { ownerId, type, metadata } = req.body;
  if (!ownerId) return res.status(400).json({ ok: false, error: 'ownerId is required' });
  const w = await wallet.createWallet(ownerId, type, metadata);
  res.status(201).json({ ok: true, wallet: w });
});

app.get('/v2/wallets/:walletId', (req, res) => {
  const result = wallet.getWallet(req.params.walletId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.post('/v2/wallets/:walletId/deposit', async (req, res) => {
  const { asset, amount, actor, traceId } = req.body;
  if (!asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'asset, amount, and actor are required' });
  }
  const result = await wallet.deposit(req.params.walletId, asset, amount, actor, traceId);
  if (!result.ok) return res.status(result.code === 'WALLET_NOT_FOUND' ? 404 : 400).json(result);
  res.json(result);
});

app.post('/v2/wallets/:walletId/withdraw', async (req, res) => {
  const { asset, amount, actor, traceId } = req.body;
  if (!asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'asset, amount, and actor are required' });
  }
  const result = await wallet.initiateWithdrawal(req.params.walletId, asset, amount, actor, traceId);
  if (!result.ok) {
    const status = result.code === 'WALLET_NOT_FOUND' ? 404 : result.code === 'INSUFFICIENT_FUNDS' ? 422 : 400;
    return res.status(status).json(result);
  }
  res.status(202).json(result);
});

app.post('/v2/wallets/:walletId/transfer', async (req, res) => {
  const { toWalletId, asset, amount, actor, traceId } = req.body;
  if (!toWalletId || !asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'toWalletId, asset, amount, and actor are required' });
  }
  const result = await wallet.transfer(req.params.walletId, toWalletId, asset, amount, actor, traceId);
  if (!result.ok) {
    const status = result.code === 'WALLET_NOT_FOUND' ? 404 : result.code === 'INSUFFICIENT_FUNDS' ? 422 : 400;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.get('/v2/wallets/:walletId/balance', (req, res) => {
  const result = wallet.getBalance(req.params.walletId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.post('/v2/wallets/:walletId/snapshot', async (req, res) => {
  const { traceId } = req.body;
  const result = await wallet.snapshotBalance(req.params.walletId, traceId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.get('/v2/wallets/:walletId/history', (req, res) => {
  const history = ledger.getHistory(req.params.walletId);
  res.json({ ok: true, walletId: req.params.walletId, count: history.length, events: history });
});

// ── Transactions ──────────────────────────────────────────────────────────────
app.post('/v2/transactions/:txId/sign', async (req, res) => {
  const { signerDid, traceId } = req.body;
  if (!signerDid) return res.status(400).json({ ok: false, error: 'signerDid is required' });
  const result = await wallet.signTransaction(req.params.txId, signerDid, traceId);
  if (!result.ok) return res.status(result.code === 'TX_NOT_FOUND' ? 404 : 400).json(result);
  res.json(result);
});

app.post('/v2/transactions/:txId/reject', async (req, res) => {
  const { actor, reason, traceId } = req.body;
  if (!actor) return res.status(400).json({ ok: false, error: 'actor is required' });
  const result = await wallet.rejectTransaction(req.params.txId, actor, reason, traceId);
  if (!result.ok) return res.status(result.code === 'TX_NOT_FOUND' ? 404 : 400).json(result);
  res.json(result);
});

app.get('/v2/transactions/:txId', (req, res) => {
  const tx = wallet.pendingTransactions.get(req.params.txId);
  if (!tx) return res.status(404).json({ ok: false, error: 'Transaction not found' });
  res.json({ ok: true, transaction: tx });
});

// ── Assets ────────────────────────────────────────────────────────────────────
app.get('/v2/assets', (_req, res) => {
  res.json({ ok: true, assets: registry.list() });
});

app.post('/v2/assets', (req, res) => {
  const { symbol, name, type, metadata } = req.body;
  if (!symbol || !name || !type) {
    return res.status(400).json({ ok: false, error: 'symbol, name, and type are required' });
  }
  if (registry.get(symbol)) {
    return res.status(409).json({ ok: false, error: `Asset ${symbol} already registered` });
  }
  const asset = registry.register(symbol, name, type, metadata || {});
  res.status(201).json({ ok: true, asset });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[WALLET-V2] Service live on port ${PORT}`);
  console.log(`[WALLET-V2] Kernel event-bus: ${process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent'}`);
});

module.exports = app;
