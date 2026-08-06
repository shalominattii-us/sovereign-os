/**
 * AEGENTIS CORPORATION — Wallet v3
 * ─────────────────────────────────────────────────────────────────────────────
 * Sovereign identity-linked wallet with DID-based signing and policy engine.
 *
 * New in v3 vs v2:
 *  • Every wallet is bound to a DID at creation time
 *  • Withdrawal signatures are cryptographically verified against the DID
 *    registry (Ed25519) rather than accepted on trust
 *  • Policy engine evaluates FREEZE, ROLE_CHECK, ASSET_WHITELIST,
 *    DAILY_LIMIT, and VELOCITY_LIMIT before any state change
 *  • Wallet delegation: owner can grant/revoke signer roles to other DIDs
 *  • Audit log: every policy decision is appended to the ledger
 *  • XVLSO (Cross-Vector Ledger Sync) snapshot: periodic cross-wallet
 *    balance snapshot emitted to the Kernel for cadet monitoring
 *
 * Version: 3.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto       = require('crypto');
const axios        = require('axios');
const ledger       = require('../treasury-ledger/ledger');
const registry     = require('../asset-registry/registry');
const didRegistry  = require('./did_registry');
const policyEngine = require('./policy_engine');

const KERNEL_URL = process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent';
const AGENT_ID   = process.env.WALLET_AGENT_ID      || 'wallet-v3-runtime';
const TX_TTL_MS  = parseInt(process.env.TX_TTL_MS   || '300000', 10);

// ── Multi-sig thresholds ──────────────────────────────────────────────────────
const SIG_THRESHOLDS = [
  { maxValue: 1_000,    required: 1 },
  { maxValue: 10_000,   required: 2 },
  { maxValue: 100_000,  required: 3 },
  { maxValue: Infinity, required: 4 }
];
function requiredSignatures(value) {
  return SIG_THRESHOLDS.find(t => value <= t.maxValue).required;
}

// ── Kernel emitter ────────────────────────────────────────────────────────────
async function emitToKernel(type, entityId, payload, traceId = null) {
  const event = {
    event_version: 1,
    domain:        'treasury',
    type,
    entity_id:     entityId,
    source:        'wallet-v3',
    actor:         `service:${AGENT_ID}`,
    trace_id:      traceId || crypto.randomUUID(),
    payload
  };
  try {
    const res = await axios.post(KERNEL_URL, event, { timeout: 3000 });
    return res.data;
  } catch (err) {
    console.warn(`[WALLET-V3] Kernel emit failed (${type}): ${err.message}`);
    return null;
  }
}

// ── WalletV3 Runtime ──────────────────────────────────────────────────────────
class WalletV3Runtime {
  constructor() {
    this.wallets             = new Map();
    this.pendingTransactions = new Map();
    this._startExpiryReaper();
    this._startXVLSOSync();
  }

  // ── DID management ──────────────────────────────────────────────────────────

  registerDID(did, publicKey, roles = ['owner']) {
    return didRegistry.register(did, publicKey, roles);
  }

  getDID(did) {
    const doc = didRegistry.get(did);
    if (!doc) return { ok: false, error: 'DID not found' };
    return { ok: true, did: doc };
  }

  revokeDID(did) {
    didRegistry.revoke(did);
    ledger.append('DID_REVOKED', did, { did }, AGENT_ID);
    return { ok: true };
  }

  // ── Wallet lifecycle ────────────────────────────────────────────────────────

  async createWallet(ownerDid, type = 'sovereign', metadata = {}) {
    if (!didRegistry.get(ownerDid)) {
      return { ok: false, code: 'DID_NOT_FOUND', error: `Owner DID not registered: ${ownerDid}` };
    }

    const walletId = `wallet-v3-${crypto.randomBytes(8).toString('hex')}`;
    const wallet   = {
      walletId,
      ownerDid,
      type,
      version:    '3.0.0',
      metadata,
      assets:     {},
      signers:    [ownerDid],   // DIDs authorised to sign transactions
      created_at: Date.now()
    };
    this.wallets.set(walletId, wallet);
    didRegistry.linkWallet(ownerDid, walletId);

    ledger.append('WALLET_CREATED', walletId, { ownerDid, type, version: '3.0.0', ...metadata }, ownerDid);
    await emitToKernel('WALLET_CREATED', walletId, { ownerDid, type, version: '3.0.0' });
    return { ok: true, wallet };
  }

  getWallet(walletId) {
    const w = this.wallets.get(walletId);
    if (!w) return { ok: false, code: 'WALLET_NOT_FOUND', error: `Wallet ${walletId} not found` };
    return { ok: true, wallet: w };
  }

  // ── Delegation ──────────────────────────────────────────────────────────────

  async delegateSigner(walletId, ownerDid, signerDid, traceId = null) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    const w = wResult.wallet;
    if (w.ownerDid !== ownerDid) return { ok: false, code: 'UNAUTHORIZED', error: 'Only the wallet owner can delegate signers' };
    if (!didRegistry.get(signerDid)) return { ok: false, code: 'DID_NOT_FOUND', error: `Signer DID not registered: ${signerDid}` };
    if (!w.signers.includes(signerDid)) w.signers.push(signerDid);
    ledger.append('SIGNER_DELEGATED', walletId, { ownerDid, signerDid }, ownerDid);
    await emitToKernel('SIGNER_DELEGATED', walletId, { ownerDid, signerDid }, traceId);
    return { ok: true, signers: w.signers };
  }

  async revokeSigner(walletId, ownerDid, signerDid, traceId = null) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    const w = wResult.wallet;
    if (w.ownerDid !== ownerDid) return { ok: false, code: 'UNAUTHORIZED', error: 'Only the wallet owner can revoke signers' };
    if (signerDid === ownerDid) return { ok: false, code: 'INVALID_OP', error: 'Cannot revoke the owner DID' };
    w.signers = w.signers.filter(s => s !== signerDid);
    ledger.append('SIGNER_REVOKED', walletId, { ownerDid, signerDid }, ownerDid);
    await emitToKernel('SIGNER_REVOKED', walletId, { ownerDid, signerDid }, traceId);
    return { ok: true, signers: w.signers };
  }

  // ── Deposits ────────────────────────────────────────────────────────────────

  async deposit(walletId, asset, amount, actor, traceId = null) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    if (!registry.get(asset)) return { ok: false, code: 'UNKNOWN_ASSET', error: `Unknown asset: ${asset}` };
    if (typeof amount !== 'number' || amount <= 0) return { ok: false, code: 'INVALID_AMOUNT', error: 'amount must be a positive number' };

    // Policy check for deposits (FREEZE only)
    const policy = await policyEngine.evaluate({ operation: 'deposit', walletId, asset, amount, actor });
    if (!policy.ok) {
      ledger.append('POLICY_VIOLATION', walletId, { operation: 'deposit', violations: policy.violations, actor }, actor);
      return { ok: false, code: 'POLICY_VIOLATION', violations: policy.violations };
    }

    const w = wResult.wallet;
    if (!w.assets[asset]) w.assets[asset] = { balance: 0, last_updated: null };
    w.assets[asset].balance     += amount;
    w.assets[asset].last_updated = Date.now();

    const event = ledger.append('DEPOSIT_RECORDED', walletId, { asset, amount }, actor);
    await emitToKernel('DEPOSIT_RECORDED', walletId, { asset, amount, actor }, traceId);
    return { ok: true, event };
  }

  // ── Withdrawals (policy + DID-verified multi-sig) ───────────────────────────

  async initiateWithdrawal(walletId, asset, amount, actor, traceId = null) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    if (!registry.get(asset)) return { ok: false, code: 'UNKNOWN_ASSET', error: `Unknown asset: ${asset}` };
    if (typeof amount !== 'number' || amount <= 0) return { ok: false, code: 'INVALID_AMOUNT', error: 'amount must be a positive number' };

    // Policy evaluation
    const policy = await policyEngine.evaluate({ operation: 'withdraw', walletId, asset, amount, actor });
    if (!policy.ok) {
      ledger.append('POLICY_VIOLATION', walletId, { operation: 'withdraw', violations: policy.violations, actor }, actor);
      await emitToKernel('POLICY_VIOLATION', walletId, { operation: 'withdraw', violations: policy.violations, actor }, traceId);
      return { ok: false, code: 'POLICY_VIOLATION', violations: policy.violations };
    }

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
      signatures:          [],   // { did, signature, timestamp }
      status:              'pending',
      expires_at:          Date.now() + TX_TTL_MS,
      created_at:          Date.now()
    };
    this.pendingTransactions.set(txId, tx);

    ledger.append('WITHDRAWAL_INITIATED', walletId, { asset, amount, txId, required_signatures: required }, actor);
    await emitToKernel('WITHDRAWAL_INITIATED', walletId, { asset, amount, txId, required_signatures: required, actor }, traceId);
    return { ok: true, txId, required_signatures: required, status: 'pending', expires_at: tx.expires_at };
  }

  /**
   * Sign a pending withdrawal with a cryptographic DID signature.
   * @param {string} txId        - transaction ID
   * @param {string} signerDid   - DID of the signer
   * @param {string} signature   - hex-encoded Ed25519 signature over txId
   */
  async signTransaction(txId, signerDid, signature, traceId = null) {
    const tx = this.pendingTransactions.get(txId);
    if (!tx)                        return { ok: false, code: 'TX_NOT_FOUND',   error: 'Transaction not found' };
    if (tx.status !== 'pending')    return { ok: false, code: 'TX_NOT_PENDING', error: `Transaction is ${tx.status}` };
    if (tx.expires_at < Date.now()) return { ok: false, code: 'TX_EXPIRED',     error: 'Transaction has expired' };

    const w = this.wallets.get(tx.walletId);
    if (w && !w.signers.includes(signerDid)) {
      return { ok: false, code: 'UNAUTHORIZED_SIGNER', error: `${signerDid} is not an authorised signer for this wallet` };
    }

    if (tx.signatures.find(s => s.did === signerDid)) {
      return { ok: false, code: 'ALREADY_SIGNED', error: 'Already signed by this DID' };
    }

    // Cryptographic signature verification
    const verification = didRegistry.verifySignature(signerDid, txId, signature);
    if (!verification.ok) {
      ledger.append('SIGNATURE_REJECTED', tx.walletId, { txId, signerDid, reason: verification.error }, signerDid);
      return { ok: false, code: 'INVALID_SIGNATURE', error: verification.error };
    }

    tx.signatures.push({ did: signerDid, signature, timestamp: Date.now() });

    if (tx.signatures.length >= tx.required_signatures) {
      tx.status = 'approved';

      // Debit balance
      if (w && w.assets[tx.asset]) {
        w.assets[tx.asset].balance     -= tx.amount;
        w.assets[tx.asset].last_updated = Date.now();
      }

      policyEngine.recordTransaction(tx.walletId);
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

    tx.status      = 'rejected';
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

    const policy = await policyEngine.evaluate({ operation: 'transfer', walletId: fromWalletId, asset, amount, actor });
    if (!policy.ok) {
      ledger.append('POLICY_VIOLATION', fromWalletId, { operation: 'transfer', violations: policy.violations, actor }, actor);
      return { ok: false, code: 'POLICY_VIOLATION', violations: policy.violations };
    }

    const from    = fromResult.wallet;
    const current = (from.assets[asset] || {}).balance || 0;
    if (current < amount) {
      return { ok: false, code: 'INSUFFICIENT_FUNDS', error: `Insufficient ${asset}: have ${current}, need ${amount}` };
    }

    from.assets[asset].balance -= amount;
    from.assets[asset].last_updated = Date.now();

    const to = toResult.wallet;
    if (!to.assets[asset]) to.assets[asset] = { balance: 0, last_updated: null };
    to.assets[asset].balance += amount;
    to.assets[asset].last_updated = Date.now();

    const tid = crypto.randomUUID();
    policyEngine.recordTransaction(fromWalletId);
    ledger.append('TRANSFER_DEBIT',  fromWalletId, { asset, amount, toWalletId, transferId: tid }, actor);
    ledger.append('TRANSFER_CREDIT', toWalletId,   { asset, amount, fromWalletId, transferId: tid }, actor);
    await emitToKernel('TRANSFER_INTENT', fromWalletId, { asset, amount, fromWalletId, toWalletId, transferId: tid, actor }, traceId);
    return { ok: true, transferId: tid, asset, amount, from: fromWalletId, to: toWalletId };
  }

  // ── Balance & snapshots ─────────────────────────────────────────────────────

  getBalance(walletId) {
    const wResult = this.getWallet(walletId);
    if (!wResult.ok) return wResult;
    return { ok: true, walletId, assets: wResult.wallet.assets };
  }

  async snapshotBalance(walletId, traceId = null) {
    const result = this.getBalance(walletId);
    if (!result.ok) return result;
    const snapshot = { walletId, assets: result.assets, snapshot_at: Date.now() };
    ledger.append('BALANCE_SNAPSHOT', walletId, snapshot, AGENT_ID);
    await emitToKernel('BALANCE_SNAPSHOT', walletId, snapshot, traceId);
    return { ok: true, snapshot };
  }

  // ── Policy management ───────────────────────────────────────────────────────

  freezeWallet(walletId) {
    policyEngine.freezeWallet(walletId);
    ledger.append('WALLET_FROZEN', walletId, {}, AGENT_ID);
    return { ok: true };
  }

  unfreezeWallet(walletId) {
    policyEngine.unfreezeWallet(walletId);
    ledger.append('WALLET_UNFROZEN', walletId, {}, AGENT_ID);
    return { ok: true };
  }

  // ── XVLSO Cross-Vector Ledger Sync ─────────────────────────────────────────

  _startXVLSOSync() {
    const interval = parseInt(process.env.XVLSO_INTERVAL_MS || '60000', 10);
    setInterval(async () => {
      const snapshot = {};
      for (const [walletId, w] of this.wallets) {
        snapshot[walletId] = { ownerDid: w.ownerDid, assets: w.assets };
      }
      await emitToKernel('XVLSO_SYNC', 'treasury', {
        wallet_count: this.wallets.size,
        snapshot,
        sync_at:      Date.now()
      });
    }, interval);
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
    }, 30_000);
  }
}

module.exports = new WalletV3Runtime();
