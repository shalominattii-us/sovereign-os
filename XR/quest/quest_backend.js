/**
 * AEGENTIS CORPORATION - AEGENTIS-X Quest Backend
 * WebXR gateway for Meta Quest 3 and Apple Vision Pro.
 * Powers the immersive Sovereign Portal experience.
 *
 * Features:
 * - WebXR session management
 * - Spatial audio routing
 * - Hand tracking event processing
 * - Meta Horizon readiness
 * - Live coding support (hot-reload via WebSocket)
 * - GeoGentic AI module integration
 * - Real-time metrics pipeline
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const commandCenter = require('../spatial-command-center/command_center');

const PORT = process.env.QUEST_BACKEND_PORT || 7778;
const KERNEL_URL = process.env.KERNEL_EVENT_BUS_URL || 'http://kernel-event-bus:8080/intent';

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/xr-stream' });

const xrSessions = new Map();

// ── WebSocket: XR Session Handler ──────────────────────────
wss.on('connection', (ws, req) => {
  const sessionId = crypto.randomUUID();
  const session = { sessionId, ws, device: null, sovereign: null, connected_at: Date.now() };
  xrSessions.set(sessionId, session);

  ws.send(JSON.stringify({ type: 'SESSION_INIT', sessionId, timestamp: Date.now() }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleXRMessage(sessionId, session, msg);
    } catch (_) {}
  });

  ws.on('close', () => {
    if (session.sovereign) {
      commandCenter.sovereignDeparted(session.sovereign);
      emitToKernel('SOVEREIGN_DEPARTED', { handle: session.sovereign, sessionId });
    }
    xrSessions.delete(sessionId);
  });
});

function handleXRMessage(sessionId, session, msg) {
  switch (msg.type) {
    case 'DEVICE_HANDSHAKE':
      session.device = msg.device; // 'quest3', 'vision_pro', 'mobile', 'desktop'
      emitToKernel('XR_DEVICE_CONNECTED', { sessionId, device: msg.device });
      break;

    case 'SOVEREIGN_ENTER':
      session.sovereign = msg.handle;
      const spatialSession = commandCenter.sovereignArrived(msg.handle, msg.tier || 'standard');
      emitToKernel('SOVEREIGN_ARRIVED', { handle: msg.handle, tier: msg.tier, device: session.device });
      session.ws.send(JSON.stringify({ type: 'PORTAL_LOADED', session: spatialSession }));
      break;

    case 'SPATIAL_UPDATE':
      commandCenter.updateSpatialState(
        `sovereign:${session.sovereign}`,
        msg.position,
        msg.orientation
      );
      emitToKernel('SPATIAL_STATE_UPDATED', {
        entity: `sovereign:${session.sovereign}`,
        position: msg.position,
        orientation: msg.orientation
      });
      break;

    case 'VOICE_COMMAND':
      const result = commandCenter.processVoiceCommand(msg.phrase, { session, sovereign: session.sovereign });
      emitToKernel('VOICE_COMMAND_RECEIVED', { phrase: msg.phrase, result });
      session.ws.send(JSON.stringify({ type: 'VOICE_COMMAND_RESULT', result }));
      break;

    case 'HAND_TRACKING':
      emitToKernel('HAND_TRACKING_UPDATE', { sessionId, hands: msg.hands });
      break;
  }
}

async function emitToKernel(type, payload) {
  try {
    await fetch(KERNEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_version: 1,
        domain: 'xr',
        type,
        entity_id: 'aegentis-x',
        source: 'quest-backend',
        actor: 'system:aegentis-x',
        payload
      })
    });
  } catch (_) {}
}

// ── REST: XR Metrics ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'AEGENTIS-X Quest Backend',
    version: '1.0.0',
    active_sessions: xrSessions.size,
    spatial: commandCenter.getSnapshot()
  });
});

app.get('/metrics', (req, res) => {
  res.json({
    active_xr_sessions: xrSessions.size,
    spatial_snapshot: commandCenter.getSnapshot(),
    timestamp: Date.now()
  });
});

server.listen(PORT, () => {
  console.log(`[AEGENTIS-X] Quest Backend live on ws://0.0.0.0:${PORT}/xr-stream`);
});

module.exports = { app, server };
