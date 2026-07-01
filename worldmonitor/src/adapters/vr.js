/**
 * adapters/vr.js
 *
 * AEGENTIS VR Backend → WorldMonitor Adapter
 * ==========================================
 * Bridges spatial events from the aegentis-vr-backend WebSocket server
 * into the WorldMonitor event bus via POST /intent.
 *
 * VR events that flow into WorldMonitor:
 *   SOVEREIGN_ARRIVAL     → xr.SOVEREIGN_ARRIVED
 *   SOVEREIGN_DEPARTURE   → xr.SOVEREIGN_DEPARTED
 *   STATE_UPDATE          → xr.SPATIAL_STATE_UPDATED
 *   GENESIS_COMPLETE      → xr.SCENE_LOADED
 *   CROSS_CHAIN_TX        → exchange.CROSS_CHAIN_TX_INITIATED
 *   GENESIS_TELEPORT      → xr.SOVEREIGN_TELEPORTED
 *
 * Usage (standalone):
 *   node src/adapters/vr.js
 *
 * Usage (as module):
 *   import { VRAdapter } from './adapters/vr.js';
 *   const adapter = new VRAdapter({ vrUrl: 'ws://localhost:7777/vr-stream?token=...' });
 *   adapter.connect();
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';
import { logger } from '../core/logger.js';

const WORLDMONITOR_URL = process.env.WORLDMONITOR_URL || 'http://localhost:8080';
const VR_BACKEND_URL   = process.env.VR_BACKEND_URL   || 'http://localhost:7777';
const VR_WS_TOKEN      = process.env.VR_WS_TOKEN      || '';

// VR message type → WorldMonitor domain + event type
const EVENT_MAP = {
  SOVEREIGN_ARRIVAL:   { domain: 'xr', type: 'SOVEREIGN_ARRIVED' },
  SOVEREIGN_DEPARTURE: { domain: 'xr', type: 'SOVEREIGN_DEPARTED' },
  STATE_SYNC:          { domain: 'xr', type: 'SPATIAL_STATE_UPDATED' },
  GENESIS_COMPLETE:    { domain: 'xr', type: 'SCENE_LOADED' },
  GENESIS_TELEPORT:    { domain: 'xr', type: 'SOVEREIGN_TELEPORTED' },
  DESTINY_PENDING:     { domain: 'exchange', type: 'CROSS_CHAIN_TX_INITIATED' },
  IMMERSION_READY:     { domain: 'xr', type: 'IMMERSION_READY' },
};

export class VRAdapter {
  constructor({ vrWsUrl, entityId = 'aegentis-vr', reconnectMs = 5000 } = {}) {
    this.vrWsUrl      = vrWsUrl || `ws://localhost:7777/vr-stream?token=${VR_WS_TOKEN}`;
    this.entityId     = entityId;
    this.reconnectMs  = reconnectMs;
    this.ws           = null;
    this.connected    = false;
  }

  async emitToWorldMonitor(domain, type, entityId, payload, traceId) {
    try {
      const res = await fetch(`${WORLDMONITOR_URL}/intent`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          type,
          entity_id:      entityId || this.entityId,
          payload,
          source:         'aegentis-vr-backend',
          actor:          payload?.from ? `sovereign:${payload.from}` : null,
          trace_id:       traceId,
        }),
      });
      const data = await res.json();
      logger.info(`VR→WM: ${domain}.${type} → ${data?.event?.event_id || 'buffered'}`);
    } catch (err) {
      logger.warn(`VR adapter emit failed: ${err.message}`);
    }
  }

  handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const mapping = EVENT_MAP[msg.type];
    if (!mapping) return; // ignore unmapped internal messages

    const entityId = msg.payload?.handle
      ? `sovereign:${msg.payload.handle}`
      : msg.payload?.targetRoom
      ? `room:${msg.payload.targetRoom}`
      : this.entityId;

    this.emitToWorldMonitor(
      mapping.domain,
      mapping.type,
      entityId,
      msg.payload || {},
    );
  }

  connect() {
    logger.info(`VR adapter connecting to ${this.vrWsUrl}`);
    this.ws = new WebSocket(this.vrWsUrl);

    this.ws.on('open', () => {
      this.connected = true;
      logger.info('VR adapter connected to aegentis-vr-backend');
      this.emitToWorldMonitor('xr', 'ADAPTER_CONNECTED', this.entityId, {
        adapter: 'aegentis-vr-backend',
        connectedAt: Date.now(),
      });
    });

    this.ws.on('message', (data) => this.handleMessage(data.toString()));

    this.ws.on('close', () => {
      this.connected = false;
      logger.warn(`VR adapter disconnected — reconnecting in ${this.reconnectMs}ms`);
      setTimeout(() => this.connect(), this.reconnectMs);
    });

    this.ws.on('error', (err) => {
      logger.warn(`VR adapter error: ${err.message}`);
    });
  }
}

// ── Standalone entry point ────────────────────────────────────────────────────
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const adapter = new VRAdapter();
  adapter.connect();
}
