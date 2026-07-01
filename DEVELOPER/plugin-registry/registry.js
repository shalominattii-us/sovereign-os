/**
 * AEGENTIS CORPORATION - Plugin Registry
 * Central registry for all division plugins and third-party extensions.
 */

const crypto = require('crypto');

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  register(plugin) {
    const { division, name, version, description, hooks = [] } = plugin;
    const pluginId = `${division.toLowerCase()}.${name.toLowerCase()}`;

    this.plugins.set(pluginId, {
      pluginId,
      division,
      name,
      version,
      description,
      hooks,
      registered_at: Date.now(),
      status: 'active'
    });

    // Register hooks
    for (const hook of hooks) {
      if (!this.hooks.has(hook)) this.hooks.set(hook, []);
      this.hooks.get(hook).push(pluginId);
    }

    console.log(`[PLUGIN-REGISTRY] Registered: ${pluginId} v${version}`);
    return pluginId;
  }

  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  getPluginsForHook(hook) {
    const ids = this.hooks.get(hook) || [];
    return ids.map(id => this.plugins.get(id)).filter(Boolean);
  }

  listAll() {
    return Array.from(this.plugins.values());
  }

  listByDivision(division) {
    return this.listAll().filter(p => p.division === division);
  }
}

const registry = new PluginRegistry();

// Register core division plugins
const coreDivisions = [
  { division: 'KERNEL', name: 'event-bus', version: '0.4.0', description: 'Kernel event bus and world state', hooks: ['on_intent', 'on_event'] },
  { division: 'KERNEL', name: 'identity-os', version: '1.0.0', description: 'Sovereign identity management', hooks: ['on_auth'] },
  { division: 'TREASURY', name: 'ledger', version: '1.0.0', description: 'Append-only treasury ledger', hooks: ['on_financial_event'] },
  { division: 'TREASURY', name: 'wallet-runtime', version: '1.0.0', description: 'Multi-asset wallet with multi-sig', hooks: ['on_transaction'] },
  { division: 'AI', name: 'llm-runtime', version: '1.0.0', description: 'Multi-LLM routing and execution', hooks: ['on_ai_request'] },
  { division: 'XR', name: 'quest-backend', version: '1.0.0', description: 'AEGENTIS-X Quest WebXR gateway', hooks: ['on_xr_event', 'on_voice_command'] },
  { division: 'SECURITY', name: 'zero-trust', version: '1.0.0', description: 'Zero trust auth middleware', hooks: ['on_request'] },
  { division: 'DATA', name: 'vector-memory', version: '1.0.0', description: 'Semantic vector memory store', hooks: ['on_memory_store'] },
  { division: 'DATA', name: 'knowledge-graph', version: '1.0.0', description: 'Cross-domain knowledge graph', hooks: ['on_entity_created'] },
];

for (const plugin of coreDivisions) registry.register(plugin);

module.exports = registry;
