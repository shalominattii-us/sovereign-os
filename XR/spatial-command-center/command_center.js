/**
 * AEGENTIS CORPORATION - XR Spatial Command Center
 * AEGENTIS-X: The VR Agentic AI Commander from SOVEREIGN.
 * Manages spatial sessions, digital twins, and voice command routing.
 * Integrates with aegentis-vr-backend WebSocket server.
 */

const crypto = require('crypto');

class SpatialCommandCenter {
  constructor() {
    this.sessions = new Map();       // active VR sessions
    this.digitalTwins = new Map();   // entity -> spatial twin
    this.voiceCommands = new Map();  // registered voice command handlers
    this.spatialGraph = new Map();   // entity -> position/orientation
  }

  /**
   * Register a sovereign entering the VR space.
   */
  sovereignArrived(handle, tier, metadata = {}) {
    const sessionId = crypto.randomUUID();
    const session = {
      sessionId,
      handle,
      tier,
      arrived_at: Date.now(),
      position: [0, 0, 0],
      orientation: [0, 0, 0, 1],
      metadata
    };
    this.sessions.set(handle, session);
    this.spatialGraph.set(`sovereign:${handle}`, session);
    return session;
  }

  sovereignDeparted(handle) {
    const session = this.sessions.get(handle);
    this.sessions.delete(handle);
    this.spatialGraph.delete(`sovereign:${handle}`);
    return session;
  }

  /**
   * Update spatial position of any entity.
   */
  updateSpatialState(entityId, position, orientation) {
    const existing = this.spatialGraph.get(entityId) || {};
    this.spatialGraph.set(entityId, {
      ...existing,
      entityId,
      position,
      orientation,
      updated_at: Date.now()
    });
  }

  /**
   * Register a digital twin for a physical or virtual entity.
   */
  registerDigitalTwin(entityId, type, properties = {}) {
    const twin = {
      twinId: crypto.randomUUID(),
      entityId,
      type,  // 'robot', 'building', 'asset', 'agent'
      properties,
      created_at: Date.now(),
      last_sync: Date.now()
    };
    this.digitalTwins.set(entityId, twin);
    return twin;
  }

  syncDigitalTwin(entityId, updates) {
    const twin = this.digitalTwins.get(entityId);
    if (!twin) return null;
    Object.assign(twin.properties, updates);
    twin.last_sync = Date.now();
    return twin;
  }

  /**
   * Register a voice command handler (voice-first interaction).
   */
  registerVoiceCommand(phrase, handler) {
    this.voiceCommands.set(phrase.toLowerCase(), handler);
  }

  processVoiceCommand(phrase, context = {}) {
    const handler = this.voiceCommands.get(phrase.toLowerCase());
    if (handler) return handler(context);
    // Fuzzy match
    for (const [cmd, fn] of this.voiceCommands.entries()) {
      if (phrase.toLowerCase().includes(cmd)) return fn(context);
    }
    return { ok: false, message: `Unknown command: ${phrase}` };
  }

  getSnapshot() {
    return {
      active_sessions: this.sessions.size,
      digital_twins: this.digitalTwins.size,
      spatial_entities: this.spatialGraph.size,
      voice_commands: this.voiceCommands.size
    };
  }
}

module.exports = new SpatialCommandCenter();
