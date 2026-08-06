/**
 * AEGENTIS CORPORATION — Wallet v1
 * ─────────────────────────────────────────────────────────────────────────────
 * Full REST API service exposing every wallet operation:
 *   POST   /wallets                       – create wallet
 *   GET    /wallets/:walletId             – get wallet metadata
 *   POST   /wallets/:walletId/deposit     – deposit an asset
 *   POST   /wallets/:walletId/withdraw    – initiate a withdrawal (multi-sig)
 *   POST   /transactions/:txId/sign       – sign a pending transaction
 *   GET    /wallets/:walletId/balance     – get current balance
 *   GET    /wallets/:walletId/history     – get ledger history for wallet
 *   GET    /assets                        – list registered assets
 *   POST   /assets                        – register a new asset
 *   GET    /health                        – service health
 *
 * Version: 1.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const ledger  = require('../treasury-ledger/ledger');
const wallet  = require('../wallet-runtime/wallet');
const registry = require('../asset-registry/registry');

const app  = express();
const PORT = process.env.WALLET_V1_PORT || 8082;

app.use(express.json());

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[WALLET-V1] ${req.method} ${req.path}`);
  next();
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'AEGENTIS-WALLET-V1',
    version: '1.0.0',
    wallets: wallet.wallets.size,
    pending_transactions: wallet.pendingTransactions.size,
    assets: registry.list().length,
    timestamp: new Date().toISOString()
  });
});

// ── Wallets ───────────────────────────────────────────────────────────────────

/**
 * POST /wallets
 * Body: { ownerId, type? }
 * Creates a new sovereign wallet for the given owner.
 */
app.post('/wallets', (req, res) => {
  const { ownerId, type } = req.body;
  if (!ownerId) return res.status(400).json({ ok: false, error: 'ownerId is required' });
  const w = wallet.createWallet(ownerId, type);
  res.status(201).json({ ok: true, wallet: w });
});

/**
 * GET /wallets/:walletId
 * Returns wallet metadata.
 */
app.get('/wallets/:walletId', (req, res) => {
  const w = wallet.wallets.get(req.params.walletId);
  if (!w) return res.status(404).json({ ok: false, error: 'Wallet not found' });
  res.json({ ok: true, wallet: w });
});

/**
 * POST /wallets/:walletId/deposit
 * Body: { asset, amount, actor }
 * Records a deposit to the wallet ledger.
 */
app.post('/wallets/:walletId/deposit', (req, res) => {
  const { asset, amount, actor } = req.body;
  if (!asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'asset, amount, and actor are required' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'amount must be a positive number' });
  }
  if (!registry.get(asset)) {
    return res.status(400).json({ ok: false, error: `Unknown asset: ${asset}` });
  }
  const result = wallet.deposit(req.params.walletId, asset, amount, actor);
  res.json(result);
});

/**
 * POST /wallets/:walletId/withdraw
 * Body: { asset, amount, actor }
 * Initiates a multi-signature withdrawal. Returns txId and required signatures.
 */
app.post('/wallets/:walletId/withdraw', (req, res) => {
  const { asset, amount, actor } = req.body;
  if (!asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'asset, amount, and actor are required' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'amount must be a positive number' });
  }
  if (!registry.get(asset)) {
    return res.status(400).json({ ok: false, error: `Unknown asset: ${asset}` });
  }
  const result = wallet.initiateWithdrawal(req.params.walletId, asset, amount, actor);
  res.status(202).json(result);
});

/**
 * GET /wallets/:walletId/balance
 * Returns the current asset balances for the wallet.
 */
app.get('/wallets/:walletId/balance', (req, res) => {
  const balance = wallet.getBalance(req.params.walletId);
  res.json({ ok: true, walletId: req.params.walletId, balance });
});

/**
 * GET /wallets/:walletId/history
 * Replays the ledger and returns all events for this wallet.
 */
app.get('/wallets/:walletId/history', (req, res) => {
  const { walletId } = req.params;
  const history = ledger.getHistory(walletId);
  res.json({ ok: true, walletId, count: history.length, events: history });
});

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * POST /transactions/:txId/sign
 * Body: { signerDid }
 * Appends a signature to a pending multi-sig transaction.
 */
app.post('/transactions/:txId/sign', (req, res) => {
  const { signerDid } = req.body;
  if (!signerDid) return res.status(400).json({ ok: false, error: 'signerDid is required' });
  const result = wallet.signTransaction(req.params.txId, signerDid);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

/**
 * GET /transactions/:txId
 * Returns a pending transaction by ID.
 */
app.get('/transactions/:txId', (req, res) => {
  const tx = wallet.pendingTransactions.get(req.params.txId);
  if (!tx) return res.status(404).json({ ok: false, error: 'Transaction not found' });
  res.json({ ok: true, transaction: tx });
});

// ── Assets ────────────────────────────────────────────────────────────────────

/**
 * GET /assets
 * Lists all registered assets.
 */
app.get('/assets', (_req, res) => {
  res.json({ ok: true, assets: registry.list() });
});

/**
 * POST /assets
 * Body: { symbol, name, type, metadata? }
 * Registers a new asset in the treasury.
 */
app.post('/assets', (req, res) => {
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

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[WALLET-V1] Service live on port ${PORT}`);
  console.log(`[WALLET-V1] Registered assets: ${registry.list().map(a => a.symbol).join(', ')}`);
});

module.exports = app;
