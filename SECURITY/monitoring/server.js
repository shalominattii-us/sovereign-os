/**
 * orbital-observer/server.js
 *
 * AEGENTIX CYBERNETICS — Orbital Observer
 * ========================================
 * The Orbital Observer is the unified observability layer for
 * AEGENTIX CYBERNETICS. It continuously reads from the WorldMonitor
 * event store and world state, aggregates metrics across all domains
 * (agents, xr, reality, exchange, robotics, treasury), and exposes
 * a real-time dashboard and SSE stream for operators and AI agents.
 *
 * Endpoints:
 *   GET /               — HTML dashboard (live metrics)
 *   GET /metrics        — JSON metrics snapshot
 *   GET /stream         — Server-Sent Events stream of all WorldMonitor events
 *   GET /health         — Observer liveness probe
 *
 * Port: 9000 (configurable via OBSERVER_PORT)
 */

import express from 'express';
import fetch from 'node-fetch';

const app  = express();
const PORT = parseInt(process.env.OBSERVER_PORT || '9000', 10);
const WM   = process.env.WORLDMONITOR_URL || 'http://localhost:8080';

// ── SSE clients ───────────────────────────────────────────────────────────────
const clients = new Set();

// ── Metrics aggregator ────────────────────────────────────────────────────────
let metrics = {
  observer:    { startedAt: Date.now(), cycles: 0 },
  worldState:  null,
  health:      null,
  lastUpdated: null,
};

async function poll() {
  try {
    const [stateRes, healthRes] = await Promise.all([
      fetch(`${WM}/state`,  { timeout: 3000 }),
      fetch(`${WM}/health`, { timeout: 3000 }),
    ]);
    metrics.worldState  = stateRes.ok  ? await stateRes.json()  : null;
    metrics.health      = healthRes.ok ? await healthRes.json() : null;
    metrics.lastUpdated = Date.now();
    metrics.observer.cycles++;

    // Broadcast to all SSE clients
    const payload = `data: ${JSON.stringify(metrics)}\n\n`;
    for (const client of clients) {
      try { client.write(payload); } catch { clients.delete(client); }
    }
  } catch (err) {
    // WorldMonitor may not be up yet — silent retry
  }
}

setInterval(poll, 2000);
poll();

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'OrbitalObserver', uptime: process.uptime() });
});

app.get('/metrics', (req, res) => {
  res.json(metrics);
});

app.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AEGENTIX CYBERNETICS — Orbital Observer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050a0f; color: #00ff88; font-family: 'Courier New', monospace; padding: 24px; }
  h1 { font-size: 1.4rem; letter-spacing: 0.2em; color: #00ffcc; margin-bottom: 8px; }
  .subtitle { font-size: 0.75rem; color: #336655; margin-bottom: 32px; letter-spacing: 0.1em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .card { background: #0a1a14; border: 1px solid #003322; border-radius: 8px; padding: 20px; }
  .card h2 { font-size: 0.7rem; letter-spacing: 0.15em; color: #336655; margin-bottom: 12px; text-transform: uppercase; }
  .value { font-size: 2rem; color: #00ff88; font-weight: bold; }
  .label { font-size: 0.65rem; color: #336655; margin-top: 4px; }
  .status-ok { color: #00ff88; } .status-warn { color: #ffaa00; } .status-err { color: #ff4444; }
  pre { font-size: 0.65rem; color: #00aa66; overflow: auto; max-height: 200px; }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  #log { background: #0a1a14; border: 1px solid #003322; border-radius: 8px; padding: 20px; margin-top: 16px; }
  #log h2 { font-size: 0.7rem; letter-spacing: 0.15em; color: #336655; margin-bottom: 12px; text-transform: uppercase; }
  #events { font-size: 0.65rem; color: #00aa66; max-height: 300px; overflow-y: auto; }
  .event-line { border-bottom: 1px solid #001a0d; padding: 4px 0; }
</style>
</head>
<body>
<h1>⬡ AEGENTIX CYBERNETICS</h1>
<p class="subtitle">ORBITAL OBSERVER — LIVE TELEMETRY</p>

<div class="grid">
  <div class="card">
    <h2>WorldMonitor</h2>
    <div class="value" id="wm-status">—</div>
    <div class="label">Kernel Status</div>
  </div>
  <div class="card">
    <h2>Stored Events</h2>
    <div class="value" id="event-count">—</div>
    <div class="label">Immutable log entries</div>
  </div>
  <div class="card">
    <h2>Replay</h2>
    <div class="value" id="replay-status">—</div>
    <div class="label">Last startup replay</div>
  </div>
  <div class="card">
    <h2>Active Robots</h2>
    <div class="value" id="robot-count">—</div>
    <div class="label">Tracked entities</div>
  </div>
  <div class="card">
    <h2>Observer Cycles</h2>
    <div class="value pulse" id="cycles">—</div>
    <div class="label">Poll cycles completed</div>
  </div>
  <div class="card">
    <h2>Last Updated</h2>
    <div class="value" id="last-updated" style="font-size:1rem">—</div>
    <div class="label">Observer last sync</div>
  </div>
</div>

<div id="log">
  <h2>Live Event Stream</h2>
  <div id="events"></div>
</div>

<script>
const es = new EventSource('/stream');
es.onmessage = (e) => {
  const m = JSON.parse(e.data);

  const health = m.health;
  const state  = m.worldState;

  document.getElementById('wm-status').textContent =
    health?.ok ? 'ONLINE' : 'OFFLINE';
  document.getElementById('wm-status').className =
    'value ' + (health?.ok ? 'status-ok' : 'status-err');

  document.getElementById('event-count').textContent =
    health?.storedEvents ?? '—';

  document.getElementById('replay-status').textContent =
    health?.replay?.status?.toUpperCase() ?? '—';
  document.getElementById('replay-status').className =
    'value ' + (health?.replay?.status === 'clean' ? 'status-ok' : 'status-warn');

  document.getElementById('robot-count').textContent =
    state ? Object.keys(state.robots || {}).length : '—';

  document.getElementById('cycles').textContent =
    m.observer?.cycles ?? '—';

  document.getElementById('last-updated').textContent =
    m.lastUpdated ? new Date(m.lastUpdated).toLocaleTimeString() : '—';

  // Append to event log
  const log = document.getElementById('events');
  const line = document.createElement('div');
  line.className = 'event-line';
  line.textContent = new Date().toISOString() + ' — events:' +
    (health?.storedEvents ?? '?') + ' robots:' +
    (state ? Object.keys(state.robots || {}).length : '?') +
    ' replay:' + (health?.replay?.status ?? '?');
  log.prepend(line);
  if (log.children.length > 100) log.removeChild(log.lastChild);
};
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', component: 'orbital-observer', message: `Orbital Observer live on port ${PORT}` }));
});
