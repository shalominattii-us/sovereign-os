/**
 * AEGENTIS CORPORATION - Plugin SDK
 * The universal interface contract for all divisions to register with the Kernel.
 */

class AegentisPlugin {
  constructor(division, name) {
    this.division = division;
    this.name = name;
    this.eventHandlers = new Map();
    this.stateProjectors = new Map();
  }

  /**
   * Register a handler for a specific event domain/type.
   */
  onEvent(domain, type, handler) {
    const key = `${domain}:${type}`;
    this.eventHandlers.set(key, handler);
  }

  /**
   * Register a state projector to build materialized views from the event stream.
   */
  registerProjector(domain, projectorFn) {
    this.stateProjectors.set(domain, projectorFn);
  }

  /**
   * Emit an intent to the Kernel Event Bus.
   */
  async emitIntent(intentPayload) {
    const url = process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentPayload)
      });
      return await response.json();
    } catch (error) {
      console.error(`[${this.division}:${this.name}] Failed to emit intent:`, error.message);
      throw error;
    }
  }

  /**
   * Mount the plugin to an Express app (for API exposure).
   */
  mount(app) {
    console.log(`[KERNEL] Mounted plugin: ${this.division} -> ${this.name}`);
  }
}

module.exports = { AegentisPlugin };
