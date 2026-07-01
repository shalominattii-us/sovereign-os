/**
 * AEGENTIS CORPORATION - Asset Registry
 * Canonical registry of all assets known to the AEGENTIS TREASURY.
 */

const ledger = require('../treasury-ledger/ledger');
const crypto = require('crypto');

class AssetRegistry {
  constructor() {
    this.assets = new Map();
  }

  register(symbol, name, type, metadata = {}) {
    const assetId = `asset-${symbol.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`;
    const asset = { assetId, symbol, name, type, metadata, registered_at: Date.now() };
    this.assets.set(symbol, asset);
    ledger.append('ASSET_REGISTERED', assetId, { symbol, name, type, ...metadata }, 'system');
    return asset;
  }

  get(symbol) {
    return this.assets.get(symbol);
  }

  list() {
    return Array.from(this.assets.values());
  }
}

const registry = new AssetRegistry();

// Register default sovereign assets
registry.register('SOV', 'Sovereign Token', 'native');
registry.register('USD', 'US Dollar', 'fiat');
registry.register('BTC', 'Bitcoin', 'crypto');
registry.register('ETH', 'Ethereum', 'crypto');

module.exports = registry;
