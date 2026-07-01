/**
 * adapters/ruview.js
 *
 * RuView Physical Reality Telemetry → WorldMonitor Adapter
 * =========================================================
 * Ingests physical-world telemetry from the RuView WiFi-to-space
 * mapper and routes it into the WorldMonitor event bus as
 * `reality` domain events.
 *
 * RuView turns commodity WiFi signals into real-time physical
 * presence and spatial coordinate data. This adapter bridges
 * that physical reality into the AEGENTIX CYBERNETICS event log,
 * making physical space a first-class observable domain.
 *
 * Events emitted to WorldMonitor:
 *   reality.PRESENCE_DETECTED      — entity detected in physical space
 *   reality.PRESENCE_LOST          — entity left the monitored zone
 *   reality.SPATIAL_UPDATE         — position/movement update
 *   reality.ANOMALY_DETECTED       — unusual signal pattern
 *   reality.ZONE_ENTERED           — entity crossed a zone boundary
 *   reality.ZONE_EXITED            — entity left a zone boundary
 *
 * Usage:
 *   node src/adapters/ruview.js
 *
 * Or as a module:
 *   import { RuViewAdapter } from './adapters/ruview.js';
 *   const adapter = new RuViewAdapter({ ruviewUrl: 'http://localhost:9090' });
 *   adapter.start();
 */

import fetch from 'node-fetch';
import { logger } from '../core/logger.js';

const WORLDMONITOR_URL = process.env.WORLDMONITOR_URL || 'http://localhost:8080';
const RUVIEW_URL       = process.env.RUVIEW_URL       || 'http://localhost:9090';
const POLL_INTERVAL_MS = parseInt(process.env.RUVIEW_POLL_MS || '2000', 10);

export class RuViewAdapter {
  constructor({ ruviewUrl, pollIntervalMs, entityPrefix = 'physical' } = {}) {
    this.ruviewUrl     = ruviewUrl || RUVIEW_URL;
    this.pollIntervalMs = pollIntervalMs || POLL_INTERVAL_MS;
    this.entityPrefix  = entityPrefix;
    this.knownEntities = new Set();
    this.running       = false;
  }

  async emitToWorldMonitor(type, entityId, payload) {
    try {
      const res = await fetch(`${WORLDMONITOR_URL}/intent`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain:    'reality',
          type,
          entity_id: entityId,
          payload,
          source:    'ruview',
          actor:     null,
        }),
      });
      const data = await res.json();
      logger.info(`RuView→WM: reality.${type} [${entityId}] → ${data?.event?.event_id || 'buffered'}`);
    } catch (err) {
      logger.warn(`RuView adapter emit failed: ${err.message}`);
    }
  }

  async pollRuView() {
    try {
      const res = await fetch(`${this.ruviewUrl}/api/presence`, { timeout: 3000 });
      if (!res.ok) return;
      const data = await res.json();

      // data.entities: array of { id, position, signal_strength, zone, anomaly }
      const entities = data.entities || [];
      const currentIds = new Set(entities.map(e => e.id));

      for (const entity of entities) {
        const entityId = `${this.entityPrefix}:${entity.id}`;

        if (!this.knownEntities.has(entity.id)) {
          // New entity detected
          this.knownEntities.add(entity.id);
          await this.emitToWorldMonitor('PRESENCE_DETECTED', entityId, {
            position:        entity.position,
            signal_strength: entity.signal_strength,
            zone:            entity.zone,
            detected_at:     Date.now(),
          });
        } else {
          // Existing entity — emit spatial update
          await this.emitToWorldMonitor('SPATIAL_UPDATE', entityId, {
            position:        entity.position,
            signal_strength: entity.signal_strength,
            zone:            entity.zone,
            updated_at:      Date.now(),
          });
        }

        // Anomaly detection
        if (entity.anomaly) {
          await this.emitToWorldMonitor('ANOMALY_DETECTED', entityId, {
            anomaly_type:  entity.anomaly.type,
            severity:      entity.anomaly.severity,
            description:   entity.anomaly.description,
            detected_at:   Date.now(),
          });
        }
      }

      // Detect departures
      for (const knownId of this.knownEntities) {
        if (!currentIds.has(knownId)) {
          this.knownEntities.delete(knownId);
          await this.emitToWorldMonitor('PRESENCE_LOST', `${this.entityPrefix}:${knownId}`, {
            lost_at: Date.now(),
          });
        }
      }
    } catch (err) {
      if (!err.message.includes('ECONNREFUSED')) {
        logger.warn(`RuView poll error: ${err.message}`);
      }
    }
  }

  async start() {
    this.running = true;
    logger.info(`RuView adapter started — polling ${this.ruviewUrl} every ${this.pollIntervalMs}ms`);

    await this.emitToWorldMonitor('ADAPTER_CONNECTED', 'ruview-adapter', {
      adapter:      'ruview',
      ruviewUrl:    this.ruviewUrl,
      pollInterval: this.pollIntervalMs,
      connectedAt:  Date.now(),
    });

    const loop = async () => {
      if (!this.running) return;
      await this.pollRuView();
      setTimeout(loop, this.pollIntervalMs);
    };
    loop();
  }

  stop() {
    this.running = false;
    logger.info('RuView adapter stopped');
  }
}

// ── Standalone entry point ────────────────────────────────────────────────────
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const adapter = new RuViewAdapter();
  adapter.start();
}
