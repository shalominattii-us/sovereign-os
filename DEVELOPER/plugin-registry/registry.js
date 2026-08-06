/**
 * AEGENTIS CORPORATION - Plugin Registry
 * Central registry for all division plugins and third-party extensions.
 */

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  register(plugin) {
    const {
      division,
      name,
      version,
      description,
      hooks = [],
      manifest = null,
      entrypoint = null,
      capabilities = []
    } = plugin;
    if (!division || !name || !version || !description) {
      throw new TypeError('Plugin registration requires division, name, version, and description');
    }
    const pluginId = `${division.toLowerCase()}.${name.toLowerCase()}`;
    if (this.plugins.has(pluginId)) {
      throw new Error(`Plugin already registered: ${pluginId}`);
    }

    this.plugins.set(pluginId, {
      pluginId,
      division,
      name,
      version,
      description,
      hooks: [...hooks],
      manifest,
      entrypoint,
      capabilities: [...capabilities],
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
  {
    division: 'FOUNDRY',
    name: 'cybercore-opportunity-intelligence',
    version: '1.0.0',
    description: 'Executable Cybercore opportunity discovery, verification, scoring, routing, and maturity-output composition',
    hooks: [
      'foundry.opportunity.discover',
      'foundry.opportunity.verify-source',
      'foundry.opportunity.score',
      'foundry.opportunity.route',
      'foundry.opportunity.emit-output'
    ],
    manifest: 'FOUNDRY/opportunity-intelligence/manifests/cybercore-opportunity-intelligence.plugin.json',
    entrypoint: 'FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js',
    capabilities: [
      'opportunity-intake',
      'source-verification',
      'strategic-intelligence',
      'commercialization-routing',
      'maturity-output'
    ]
  },
];

for (const plugin of coreDivisions) registry.register(plugin);

module.exports = registry;
