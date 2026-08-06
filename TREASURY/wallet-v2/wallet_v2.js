/**
 * AEGENTIS CORPORATION — Wallet v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-asset wallet runtime with full Kernel event-bus integration.
 *
 * New in v2 vs v1:
 *  • Every wallet operation emits a canonical event to the Kernel Event Bus
 *    (WALLET_CREATED, DEPOSIT_RECORDED, WITHDRAWAL_INITIATED,
 *     WITHDRAWAL_APPROVED, WITHDRAWAL_REJECTED, TRANSFER_INTENT,
 *     BALANCE_SNAPSHOT)
 *  • Multi-asset portfolio tracking with per-asset allocation metadata
 *  • Transfer between wallets (intra-treasury atomic transfer)
 *  • Balance snapshot on demand (emitted to Kernel for state projection)
 *  • Withdrawal expiry: pending transactions expire after TTL_MS
 *  • Structured error codes for all failure paths
 *
 * Version: 2.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto   = require('crypto');
const axios    = require('axios');
const ledger   = require('../treasury-ledger/ledger');
const registry = require('../asset-registry/registry');

const KERNEL_URL  = process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent';
const AGENT_ID    = process.env.WALLET_AGENT_ID      || 'wallet-v2-runtime';
const TX_TTL_MS   = parseInt(process.env.TX_TTL_MS   || '300000', 10); // 5 min default

// ── Multi-sig thresholds (USD equivalent) ─────────────────────────────────────
const SIG_THRESHOLDS = [
  { maxValue: 1_000,    required: 1 },
  { maxValue: 10_000,   required: 2 },
  { maxValue: 100_000,  required: 3 },
  { maxValue: Infinity, required: 4 }
];

function requiredSignatures(value) {
  return SIG_THRESHOLDS.find(t => value <= t.maxValue).required;
}

// ── Kernel event emitter ──────────────────────────────────────────────────────
async function emitToKernel(type, entityId, payload, traceId = null) {
  const event = {
    event_version: 1,
    domain:        'treasury',
    type,
    entity_id:     entityId,
    source:        'wallet-v2',
    actor:         `service:${AGENT_ID}`,
    trace_id:      traceId || crypto.randomUUID(),
    payload
  };
  try {
    const res = await axios.post(KERNEL_URL, event, { timeout: 3000 });
    return res.data;
  } catch (err) {
    // Non-fatal: log and continue — wallet ops must not block on Kernel availability
    console.warn(`[WALLET-V2] Kernel emit failed (${type}): ${err.message}`);
    return null;
  }
}

// ── WalletV2 Runtime ──────────────────────────────────────────────────────────
class WalletV2Runtime {
  constructor() {
    this.wallets             = new Map();
    this.pendingTransactions = new Map();
    this._startExpiryReaper();
  }

  // ── Wallet lifecycle ────────────────────────────────────────────────────────

  async createWallet(ownerId, type = 'sovereign', metadata = {}) {
    const walletId = `wallet-v2-${crypto.randomBytes(8).toString('hex')}`;
    const wallet   = {
      walletId,
      ownerId,
      type,
      version:    '2.0.0',
      metadata,
      assets:     {},           // symbol → { balance, last_updated }
      created_at: Date.now()
    };
    this.wallets.set(walletId, wallet);
    ledger.append('WALLET_CREATED', walletId, { ownerId, type, version: '2.0.0', ...metadata }, ownerId);
    await emitToKernel('WALLET_CREATED', walletId, { ownerId, type, version: '2.0.0' });
    return wallet;
  }

  getWallet(walletId) {
    const w = this.wallets.get(walletId);
    if (!w) return { ok: false, code: 'WALLET_NOT_FOUND', error: `Wallet ${walletId} not found` };
    return { ok: true, wallet: w };
  }

  // ── Deposits ────────────────────────────────────────────────────────────────

  async deposit(walletId, asset, amount, actor, traceId = null) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    if (!registry.get(asset)) return { ok: false, code: 'UNKNOWN_ASSET', error: `Unknown asset: ${asset}` };
    if (typeof amount !== 'number' || amount <= 0) return { ok: false, code: 'INVALID_AMOUNT', error: 'amount must be a positive number' };

    const w = wResult.wallet;
    if (!w.assets[asset]) w.assets[asset] = { balance: 0, last_updated: null };
    w.assets[asset].balance     += amount;
    w.assets[asset].last_updated = Date.now();

    const event = ledger.append('DEPOSIT_RECORDED', walletId, { asset, amount }, actor);
    await emitToKernel('DEPOSIT_RECORDED', walletId, { asset, amount, actor }, traceId);
    return { ok: true, event };
  }

  // ── Withdrawals (multi-sig) ─────────────────────────────────────────────────

  async initiateWithdrawal(walletId, asset, amount, actor, traceId = null) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    if (!registry.get(asset)) return { ok: false, code: 'UNKNOWN_ASSET', error: `Unknown asset: ${asset}` };
    if (typeof amount !== 'number' || amount <= 0) return { ok: false, code: 'INVALID_AMOUNT', error: 'amount must be a positive number' };

    const w       = wResult.wallet;
    const current = (w.assets[asset] || {}).balance || 0;
    if (current < amount) {
      return { ok: false, code: 'INSUFFICIENT_FUNDS', error: `Insufficient ${asset}: have ${current}, need ${amount}` };
    }

    const required = requiredSignatures(amount);
    const txId     = crypto.randomUUID();
    const tx = {
      txId, walletId, asset, amount, actor,
      required_signatures: required,
      signatures:          [],
      status:              'pending',
      expires_at:          Date.now() + TX_TTL_MS,
      created_at:          Date.now()
    };
    this.pendingTransactions.set(txId, tx);

    ledger.append('WITHDRAWAL_INITIATED', walletId, { asset, amount, txId, required_signatures: required }, actor);
    await emitToKernel('WITHDRAWAL_INITIATED', walletId, { asset, amount, txId, required_signatures: required, actor }, traceId);
    return { ok: true, txId, required_signatures: required, status: 'pending', expires_at: tx.expires_at };
  }

  async signTransaction(txId, signerDid, traceId = null) {
    const tx = this.pendingTransactions.get(txId);
    if (!tx)                           return { ok: false, code: 'TX_NOT_FOUND',   error: 'Transaction not found' };
    if (tx.status !== 'pending')       return { ok: false, code: 'TX_NOT_PENDING', error: `Transaction is ${tx.status}` };
    if (tx.expires_at < Date.now())    return { ok: false, code: 'TX_EXPIRED',     error: 'Transaction has expired' };
    if (tx.signatures.includes(signerDid)) return { ok: false, code: 'ALREADY_SIGNED', error: 'Already signed by this DID' };

    tx.signatures.push(signerDid);

    if (tx.signatures.length >= tx.required_signatures) {
      tx.status = 'approved';

      // Debit the in-memory balance
      const w = this.wallets.get(tx.walletId);
      if (w && w.assets[tx.asset]) {
        w.assets[tx.asset].balance     -= tx.amount;
        w.assets[tx.asset].last_updated = Date.now();
      }

      ledger.append('WITHDRAWAL_RECORDED', tx.walletId, { asset: tx.asset, amount: tx.amount, txId }, signerDid);
      await emitToKernel('WITHDRAWAL_APPROVED', tx.walletId, { asset: tx.asset, amount: tx.amount, txId }, traceId);
    }

    return {
      ok:         true,
      status:     tx.status,
      signatures: tx.signatures.length,
      required:   tx.required_signatures
    };
  }

  async rejectTransaction(txId, actor, reason = '', traceId = null) {
    const tx = this.pendingTransactions.get(txId);
    if (!tx)                     return { ok: false, code: 'TX_NOT_FOUND',   error: 'Transaction not found' };
    if (tx.status !== 'pending') return { ok: false, code: 'TX_NOT_PENDING', error: `Transaction is ${tx.status}` };

    tx.status    = 'rejected';
    tx.rejected_by = actor;
    tx.rejected_at = Date.now();

    ledger.append('WITHDRAWAL_REJECTED', tx.walletId, { asset: tx.asset, amount: tx.amount, txId, reason }, actor);
    await emitToKernel('WITHDRAWAL_REJECTED', tx.walletId, { txId, reason, actor }, traceId);
    return { ok: true, status: 'rejected' };
  }

  // ── Transfers ───────────────────────────────────────────────────────────────

  async transfer(fromWalletId, toWalletId, asset, amount, actor, traceId = null) {
    const fromResult = this.getWallet(fromWalletId);
    const toResult   = this.getWallet(toWalletId);
    if (!fromResult.ok) return fromResult;
    if (!toResult.ok)   return toResult;
    if (!registry.get(asset)) return { ok: false, code: 'UNKNOWN_ASSET', error: `Unknown asset: ${asset}` };

    const from    = fromResult.wallet;
    const current = (from.assets[asset] || {}).balance || 0;
    if (current < amount) {
      return { ok: false, code: 'INSUFFICIENT_FUNDS', error: `Insufficient ${asset}: have ${current}, need ${amount}` };
    }

    // Atomic debit / credit
    from.assets[asset].balance -= amount;
    from.assets[asset].last_updated = Date.now();

    const to = toResult.wallet;
    if (!to.assets[asset]) to.assets[asset] = { balance: 0, last_updated: null };
    to.assets[asset].balance += amount;
    to.assets[asset].last_updated = Date.now();

    const tid = crypto.randomUUID();
    ledger.append('TRANSFER_DEBIT',  fromWalletId, { asset, amount, toWalletId, transferId: tid }, actor);
    ledger.append('TRANSFER_CREDIT', toWalletId,   { asset, amount, fromWalletId, transferId: tid }, actor);
    await emitToKernel('TRANSFER_INTENT', fromWalletId, { asset, amount, fromWalletId, toWalletId, transferId: tid, actor }, traceId);
    return { ok: true, transferId: tid, asset, amount, from: fromWalletId, to: toWalletId };
  }

  // ── Balance & snapshot ──────────────────────────────────────────────────────

  getBalance(walletId) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    return { ok: true, walletId, assets: wResult.wallet.assets };
  }

  async snapshotBalance(walletId, traceId = null) {
    const result = this.getBalance(walletId);
    if (!result.ok) return result;
    const snapshot = {
      walletId,
      assets:       result.assets,
      snapshot_at:  Date.now()
    };
    ledger.append('BALANCE_SNAPSHOT', walletId, snapshot, AGENT_ID);
    await emitToKernel('BALANCE_SNAPSHOT', walletId, snapshot, traceId);
    return { ok: true, snapshot };
  }

  // ── Expiry reaper ───────────────────────────────────────────────────────────

  _startExpiryReaper() {
    setInterval(() => {
      const now = Date.now();
      for (const [txId, tx] of this.pendingTransactions) {
        if (tx.status === 'pending' && tx.expires_at < now) {
          tx.status = 'expired';
          ledger.append('WITHDRAWAL_EXPIRED', tx.walletId, { txId, asset: tx.asset, amount: tx.amount }, AGENT_ID);
          emitToKernel('WITHDRAWAL_EXPIRED', tx.walletId, { txId });
        }
      }
    }, 30_000); // check every 30 s
  }
}

module.exports = new WalletV2Runtime();
