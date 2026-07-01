/**
 * AEGENTIS CORPORATION - Wallet Runtime
 * Sovereign multi-asset wallet with multi-signature thresholds.
 * Signature thresholds scale with monetary value per AEGENTIX policy.
 */

const ledger = require('../treasury-ledger/ledger');
const crypto = require('crypto');

// Multi-signature thresholds (value in USD equivalent)
const SIG_THRESHOLDS = [
  { maxValue: 1_000,       required: 1 },
  { maxValue: 10_000,      required: 2 },
  { maxValue: 100_000,     required: 3 },
  { maxValue: Infinity,    required: 4 }
];

function requiredSignatures(value) {
  return SIG_THRESHOLDS.find(t => value <= t.maxValue).required;
}

class WalletRuntime {
  constructor() {
    this.wallets = new Map();
    this.pendingTransactions = new Map();
  }

  createWallet(ownerId, type = 'sovereign') {
    const walletId = `wallet-${crypto.randomBytes(8).toString('hex')}`;
    const wallet = { walletId, ownerId, type, created_at: Date.now() };
    this.wallets.set(walletId, wallet);
    ledger.append('WALLET_CREATED', walletId, { ownerId, type }, ownerId);
    return wallet;
  }

  deposit(walletId, asset, amount, actor) {
    const event = ledger.append('DEPOSIT_RECORDED', walletId, { asset, amount }, actor);
    return { ok: true, event };
  }

  initiateWithdrawal(walletId, asset, amount, actor) {
    const required = requiredSignatures(amount);
    const txId = crypto.randomUUID();
    const tx = {
      txId, walletId, asset, amount, actor,
      required_signatures: required,
      signatures: [],
      status: 'pending',
      created_at: Date.now()
    };
    this.pendingTransactions.set(txId, tx);
    ledger.append('WITHDRAWAL_INITIATED', walletId, { asset, amount, txId, required_signatures: required }, actor);
    return { txId, required_signatures: required, status: 'pending' };
  }

  signTransaction(txId, signerDid) {
    const tx = this.pendingTransactions.get(txId);
    if (!tx) return { ok: false, error: 'Transaction not found' };
    if (tx.signatures.includes(signerDid)) return { ok: false, error: 'Already signed' };
    tx.signatures.push(signerDid);
    if (tx.signatures.length >= tx.required_signatures) {
      tx.status = 'approved';
      ledger.append('WITHDRAWAL_RECORDED', tx.walletId, { asset: tx.asset, amount: tx.amount, txId }, signerDid);
    }
    return { ok: true, status: tx.status, signatures: tx.signatures.length, required: tx.required_signatures };
  }

  getBalance(walletId) {
    return ledger.getBalance(walletId);
  }
}

module.exports = new WalletRuntime();
