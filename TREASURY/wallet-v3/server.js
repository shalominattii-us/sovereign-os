/**
 * AEGENTIS CORPORATION — Wallet v3 REST Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes the WalletV3Runtime over HTTP.
 *
 * All endpoints are prefixed with /v3.
 *
 * DID endpoints:
 *   POST   /v3/dids                             – register a DID
 *   GET    /v3/dids/:did                        – get DID document
 *   DELETE /v3/dids/:did                        – revoke a DID
 *
 * Wallet endpoints:
 *   POST   /v3/wallets                          – create wallet (requires DID)
 *   GET    /v3/wallets/:walletId                – get wallet
 *   POST   /v3/wallets/:walletId/deposit        – deposit asset
 *   POST   /v3/wallets/:walletId/withdraw       – initiate withdrawal
 *   POST   /v3/wallets/:walletId/transfer       – transfer to another wallet
 *   GET    /v3/wallets/:walletId/balance        – current balance
 *   POST   /v3/wallets/:walletId/snapshot       – emit XVLSO balance snapshot
 *   GET    /v3/wallets/:walletId/history        – ledger history
 *   POST   /v3/wallets/:walletId/freeze         – freeze wallet
 *   POST   /v3/wallets/:walletId/unfreeze       – unfreeze wallet
 *   POST   /v3/wallets/:walletId/signers        – delegate signer DID
 *   DELETE /v3/wallets/:walletId/signers/:did   – revoke signer DID
 *
 * Transaction endpoints:
 *   POST   /v3/transactions/:txId/sign          – sign with DID + signature
 *   POST   /v3/transactions/:txId/reject        – reject
 *   GET    /v3/transactions/:txId               – get transaction
 *
 * Asset endpoints:
 *   GET    /v3/assets                           – list assets
 *   POST   /v3/assets                           – register asset
 *
 * Policy endpoints:
 *   GET    /v3/policy/config                    – view policy config
 *
 * Version: 3.0.0
 * Port:    8084 (override with WALLET_V3_PORT)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express      = require('express');
const wallet       = require('./wallet_v3');
const policyEngine = require('./policy_engine');
const registry     = require('../asset-registry/registry');
const ledger       = require('../treasury-ledger/ledger');

const app  = express();
const PORT = process.env.WALLET_V3_PORT || 8084;

app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[WALLET-V3] ${req.method} ${req.path}`);
  next();
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    ok:                   true,
    service:              'AEGENTIS-WALLET-V3',
    version:              '3.0.0',
    wallets:              wallet.wallets.size,
    pending_transactions: wallet.pendingTransactions.size,
    assets:               registry.list().length,
    timestamp:            new Date().toISOString()
  });
});

// ── DID endpoints ─────────────────────────────────────────────────────────────
app.post('/v3/dids', (req, res) => {
  const { did, publicKey, roles } = req.body;
  if (!did || !publicKey) return res.status(400).json({ ok: false, error: 'did and publicKey are required' });
  try {
    const doc = wallet.registerDID(did, publicKey, roles);
    res.status(201).json({ ok: true, did: doc });
  } catch (err) {
    res.status(409).json({ ok: false, error: err.message });
  }
});

app.get('/v3/dids/:did', (req, res) => {
  const result = wallet.getDID(decodeURIComponent(req.params.did));
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.delete('/v3/dids/:did', (req, res) => {
  try {
    const result = wallet.revokeDID(decodeURIComponent(req.params.did));
    res.json(result);
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// ── Wallet endpoints ──────────────────────────────────────────────────────────
app.post('/v3/wallets', async (req, res) => {
  const { ownerDid, type, metadata } = req.body;
  if (!ownerDid) return res.status(400).json({ ok: false, error: 'ownerDid is required' });
  const result = await wallet.createWallet(ownerDid, type, metadata);
  if (!result.ok) return res.status(result.code === 'DID_NOT_FOUND' ? 404 : 400).json(result);
  res.status(201).json(result);
});

app.get('/v3/wallets/:walletId', (req, res) => {
  const result = wallet.getWallet(req.params.walletId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.post('/v3/wallets/:walletId/deposit', async (req, res) => {
  const { asset, amount, actor, traceId } = req.body;
  if (!asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'asset, amount, and actor are required' });
  }
  const result = await wallet.deposit(req.params.walletId, asset, amount, actor, traceId);
  if (!result.ok) {
    const status = result.code === 'WALLET_NOT_FOUND' ? 404 : result.code === 'POLICY_VIOLATION' ? 403 : 400;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.post('/v3/wallets/:walletId/withdraw', async (req, res) => {
  const { asset, amount, actor, traceId } = req.body;
  if (!asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'asset, amount, and actor are required' });
  }
  const result = await wallet.initiateWithdrawal(req.params.walletId, asset, amount, actor, traceId);
  if (!result.ok) {
    const status = result.code === 'WALLET_NOT_FOUND' ? 404
                 : result.code === 'INSUFFICIENT_FUNDS' ? 422
                 : result.code === 'POLICY_VIOLATION' ? 403 : 400;
    return res.status(status).json(result);
  }
  res.status(202).json(result);
});

app.post('/v3/wallets/:walletId/transfer', async (req, res) => {
  const { toWalletId, asset, amount, actor, traceId } = req.body;
  if (!toWalletId || !asset || amount == null || !actor) {
    return res.status(400).json({ ok: false, error: 'toWalletId, asset, amount, and actor are required' });
  }
  const result = await wallet.transfer(req.params.walletId, toWalletId, asset, amount, actor, traceId);
  if (!result.ok) {
    const status = result.code === 'WALLET_NOT_FOUND' ? 404
                 : result.code === 'INSUFFICIENT_FUNDS' ? 422
                 : result.code === 'POLICY_VIOLATION' ? 403 : 400;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.get('/v3/wallets/:walletId/balance', (req, res) => {
  const result = wallet.getBalance(req.params.walletId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.post('/v3/wallets/:walletId/snapshot', async (req, res) => {
  const result = await wallet.snapshotBalance(req.params.walletId, req.body.traceId);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

app.get('/v3/wallets/:walletId/history', (req, res) => {
  const history = ledger.getHistory(req.params.walletId);
  res.json({ ok: true, walletId: req.params.walletId, count: history.length, events: history });
});

app.post('/v3/wallets/:walletId/freeze', (req, res) => {
  res.json(wallet.freezeWallet(req.params.walletId));
});

app.post('/v3/wallets/:walletId/unfreeze', (req, res) => {
  res.json(wallet.unfreezeWallet(req.params.walletId));
});

app.post('/v3/wallets/:walletId/signers', async (req, res) => {
  const { ownerDid, signerDid, traceId } = req.body;
  if (!ownerDid || !signerDid) return res.status(400).json({ ok: false, error: 'ownerDid and signerDid are required' });
  const result = await wallet.delegateSigner(req.params.walletId, ownerDid, signerDid, traceId);
  if (!result.ok) return res.status(result.code === 'UNAUTHORIZED' ? 403 : 404).json(result);
  res.json(result);
});

app.delete('/v3/wallets/:walletId/signers/:did', async (req, res) => {
  const { ownerDid, traceId } = req.body;
  if (!ownerDid) return res.status(400).json({ ok: false, error: 'ownerDid is required in body' });
  const result = await wallet.revokeSigner(req.params.walletId, ownerDid, decodeURIComponent(req.params.did), traceId);
  if (!result.ok) return res.status(result.code === 'UNAUTHORIZED' ? 403 : 400).json(result);
  res.json(result);
});

// ── Transaction endpoints ─────────────────────────────────────────────────────
app.post('/v3/transactions/:txId/sign', async (req, res) => {
  const { signerDid, signature, traceId } = req.body;
  if (!signerDid || !signature) {
    return res.status(400).json({ ok: false, error: 'signerDid and signature (hex Ed25519) are required' });
  }
  const result = await wallet.signTransaction(req.params.txId, signerDid, signature, traceId);
  if (!result.ok) {
    const status = result.code === 'TX_NOT_FOUND' ? 404
                 : result.code === 'UNAUTHORIZED_SIGNER' || result.code === 'INVALID_SIGNATURE' ? 403 : 400;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.post('/v3/transactions/:txId/reject', async (req, res) => {
  const { actor, reason, traceId } = req.body;
  if (!actor) return res.status(400).json({ ok: false, error: 'actor is required' });
  const result = await wallet.rejectTransaction(req.params.txId, actor, reason, traceId);
  if (!result.ok) return res.status(result.code === 'TX_NOT_FOUND' ? 404 : 400).json(result);
  res.json(result);
});

app.get('/v3/transactions/:txId', (req, res) => {
  const tx = wallet.pendingTransactions.get(req.params.txId);
  if (!tx) return res.status(404).json({ ok: false, error: 'Transaction not found' });
  res.json({ ok: true, transaction: tx });
});

// ── Asset endpoints ───────────────────────────────────────────────────────────
app.get('/v3/assets', (_req, res) => {
  res.json({ ok: true, assets: registry.list() });
});

app.post('/v3/assets', (req, res) => {
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

// ── Policy endpoints ──────────────────────────────────────────────────────────
app.get('/v3/policy/config', (_req, res) => {
  const cfg = policyEngine.config;
  res.json({
    ok: true,
    config: {
      daily_limits:    cfg.daily_limits,
      velocity:        cfg.velocity,
      asset_whitelist: cfg.asset_whitelist,
      frozen_wallets:  Array.from(cfg.frozen_wallets)
    }
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[WALLET-V3] Service live on port ${PORT}`);
  console.log(`[WALLET-V3] Kernel event-bus: ${process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent'}`);
  console.log(`[WALLET-V3] XVLSO sync interval: ${process.env.XVLSO_INTERVAL_MS || 60000}ms`);
});

module.exports = app;
