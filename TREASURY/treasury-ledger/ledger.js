/**
 * AEGENTIS CORPORATION - Treasury Ledger
 * Append-only financial event ledger. Inherits EVENT_SPEC_v1 from the Kernel.
 * All balances are derived from the event log — never stored directly.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LEDGER_PATH = path.join(__dirname, '../../data/treasury.jsonl');

class TreasuryLedger {
  constructor() {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Append a financial event to the immutable ledger.
   */
  append(type, entityId, payload, actor = null) {
    const event = {
      event_id: crypto.randomUUID(),
      event_version: 1,
      timestamp: Date.now(),
      domain: 'treasury',
      type,
      entity_id: entityId,
      actor,
      payload
    };
    fs.appendFileSync(LEDGER_PATH, JSON.stringify(event) + '\n');
    return event;
  }

  /**
   * Replay the ledger to compute current balances.
   */
  computeBalances() {
    if (!fs.existsSync(LEDGER_PATH)) return {};
    const balances = {};
    const lines = fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const { entity_id, type, payload } = event;
        if (!balances[entity_id]) {
          balances[entity_id] = { assets: {}, transactions: 0 };
        }
        if (type === 'ASSET_REGISTERED') {
          balances[entity_id].assets[payload.asset] = payload.amount;
        } else if (type === 'DEPOSIT_RECORDED') {
          balances[entity_id].assets[payload.asset] =
            (balances[entity_id].assets[payload.asset] || 0) + payload.amount;
        } else if (type === 'WITHDRAWAL_RECORDED') {
          balances[entity_id].assets[payload.asset] =
            (balances[entity_id].assets[payload.asset] || 0) - payload.amount;
        } else if (type === 'CORRECTION_ISSUED') {
          balances[entity_id].assets[payload.asset] = payload.corrected_balance;
        }
        balances[entity_id].transactions++;
      } catch (_) {}
    }
    return balances;
  }

  /**
   * Get the current balance for a specific entity.
   */
  getBalance(entityId) {
    const all = this.computeBalances();
    return all[entityId] || { assets: {}, transactions: 0 };
  }
}

module.exports = new TreasuryLedger();
