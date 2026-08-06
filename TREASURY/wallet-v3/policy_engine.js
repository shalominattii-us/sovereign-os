/**
 * AEGENTIS CORPORATION — Wallet v3 Policy Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Evaluates treasury policies before any state-changing wallet operation.
 *
 * Built-in policies:
 *   ROLE_CHECK        – actor must hold the required role in the DID registry
 *   DAILY_LIMIT       – per-wallet per-asset daily withdrawal cap
 *   VELOCITY_LIMIT    – max N transactions within a rolling window
 *   ASSET_WHITELIST   – only whitelisted assets may be withdrawn
 *   FREEZE            – frozen wallets reject all withdrawals
 *
 * Custom policies can be registered at runtime via `registerPolicy()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const didRegistry = require('./did_registry');

// ── Default policy configuration ──────────────────────────────────────────────
const DEFAULT_CONFIG = {
  daily_limits: {
    USD: 50_000,
    BTC: 5,
    ETH: 100,
    SOV: Infinity
  },
  velocity: {
    window_ms:    3_600_000, // 1 hour
    max_tx_count: 20
  },
  asset_whitelist:  ['USD', 'BTC', 'ETH', 'SOV'],
  frozen_wallets:   new Set()
};

class PolicyEngine {
  constructor(config = {}) {
    this.config  = { ...DEFAULT_CONFIG, ...config };
    /** @type {Map<string, Function>} name → async policy fn */
    this.policies = new Map();

    // Register built-in policies
    this._registerBuiltins();

    /** Rolling transaction log: walletId → [{ timestamp }] */
    this._txLog = new Map();
  }

  /**
   * Register a custom policy function.
   * @param {string}   name   - unique policy name
   * @param {Function} fn     - async (context) => { ok, error? }
   */
  registerPolicy(name, fn) {
    this.policies.set(name, fn);
  }

  /**
   * Evaluate all registered policies for a given operation context.
   * @param {Object} context
   * @param {string} context.operation  - 'deposit'|'withdraw'|'transfer'
   * @param {string} context.walletId
   * @param {string} context.asset
   * @param {number} context.amount
   * @param {string} context.actor      - DID of the initiating party
   * @returns {Promise<{ ok: boolean, violations: string[] }>}
   */
  async evaluate(context) {
    const violations = [];
    for (const [name, fn] of this.policies) {
      try {
        const result = await fn(context, this.config, this._txLog);
        if (!result.ok) violations.push(`[${name}] ${result.error}`);
      } catch (err) {
        violations.push(`[${name}] Policy error: ${err.message}`);
      }
    }
    return { ok: violations.length === 0, violations };
  }

  /**
   * Record a completed transaction for velocity tracking.
   */
  recordTransaction(walletId) {
    if (!this._txLog.has(walletId)) this._txLog.set(walletId, []);
    this._txLog.get(walletId).push({ timestamp: Date.now() });
  }

  /**
   * Freeze / unfreeze a wallet.
   */
  freezeWallet(walletId)   { this.config.frozen_wallets.add(walletId); }
  unfreezeWallet(walletId) { this.config.frozen_wallets.delete(walletId); }

  // ── Built-in policy registrations ──────────────────────────────────────────

  _registerBuiltins() {

    // 1. FREEZE check
    this.policies.set('FREEZE', (ctx, cfg) => {
      if (ctx.operation !== 'withdraw' && ctx.operation !== 'transfer') return { ok: true };
      if (cfg.frozen_wallets.has(ctx.walletId)) {
        return { ok: false, error: `Wallet ${ctx.walletId} is frozen` };
      }
      return { ok: true };
    });

    // 2. ROLE_CHECK — actor must be 'owner' or 'signer' for withdrawals
    this.policies.set('ROLE_CHECK', (ctx) => {
      if (ctx.operation !== 'withdraw' && ctx.operation !== 'transfer') return { ok: true };
      if (!ctx.actor) return { ok: false, error: 'No actor DID provided' };
      const allowed = didRegistry.hasRole(ctx.actor, 'owner') ||
                      didRegistry.hasRole(ctx.actor, 'signer');
      if (!allowed) {
        return { ok: false, error: `Actor ${ctx.actor} lacks owner/signer role` };
      }
      return { ok: true };
    });

    // 3. ASSET_WHITELIST
    this.policies.set('ASSET_WHITELIST', (ctx, cfg) => {
      if (ctx.operation !== 'withdraw' && ctx.operation !== 'transfer') return { ok: true };
      if (!cfg.asset_whitelist.includes(ctx.asset)) {
        return { ok: false, error: `Asset ${ctx.asset} is not whitelisted for withdrawal` };
      }
      return { ok: true };
    });

    // 4. DAILY_LIMIT — per-asset rolling 24-hour cap
    this.policies.set('DAILY_LIMIT', (ctx, cfg, txLog) => {
      if (ctx.operation !== 'withdraw' && ctx.operation !== 'transfer') return { ok: true };
      const cap = cfg.daily_limits[ctx.asset];
      if (cap === undefined || cap === Infinity) return { ok: true };

      const window  = Date.now() - 86_400_000; // 24 h
      const entries = (txLog.get(ctx.walletId) || []).filter(e => e.timestamp > window && e.asset === ctx.asset);
      const spent   = entries.reduce((s, e) => s + (e.amount || 0), 0);

      if (spent + ctx.amount > cap) {
        return {
          ok:    false,
          error: `Daily limit for ${ctx.asset} exceeded: ${spent + ctx.amount} > ${cap}`
        };
      }
      return { ok: true };
    });

    // 5. VELOCITY_LIMIT — max N transactions per rolling window
    this.policies.set('VELOCITY_LIMIT', (ctx, cfg, txLog) => {
      if (ctx.operation !== 'withdraw' && ctx.operation !== 'transfer') return { ok: true };
      const { window_ms, max_tx_count } = cfg.velocity;
      const cutoff  = Date.now() - window_ms;
      const recent  = (txLog.get(ctx.walletId) || []).filter(e => e.timestamp > cutoff);
      if (recent.length >= max_tx_count) {
        return {
          ok:    false,
          error: `Velocity limit: ${recent.length} transactions in the last ${window_ms / 60_000} min (max ${max_tx_count})`
        };
      }
      return { ok: true };
    });
  }
}

module.exports = new PolicyEngine();
