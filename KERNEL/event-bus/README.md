# WorldMonitor v0.2

**WorldMonitor** is the global event and state engine for [Sovereign OS / AEGENTIS](https://github.com/shalominattii-us/sovereign-os).

It implements an **event-sourced runtime**: every accepted command is persisted to an append-only log (`data/events.jsonl`), and world state is deterministically rebuilt from that log on every startup.

---

## Architecture

```
index.js                  ← Entry point + startup replay
│
src/
├── api/
│   ├── intent.js         ← POST /intent   — accept and execute commands
│   ├── state.js          ← GET  /state    — live world state snapshot
│   └── health.js         ← GET  /health   — liveness probe
│
├── core/
│   ├── eventBus.js       ← Enrich raw payloads into events; persist on emit
│   ├── policyEngine.js   ← Validate events against domain rules
│   ├── router.js         ← Dispatch events to domain handlers
│   └── logger.js         ← Structured JSON logger
│
├── events/
│   ├── schemas.js        ← Canonical event type and domain registry
│   └── eventStore.js     ← Append-only JSONL persistence + replay loader
│
├── state/
│   ├── worldState.js     ← In-memory state store (robots, treasury, xr)
│   ├── projector.js      ← Applies events to world state (single mutation point)
│   └── selectors.js      ← Read-only queries over world state
│
└── adapters/
    ├── ros2/             ← (stub) ROS2 bridge
    ├── treasury/         ← (stub) Treasury adapter
    ├── xr/               ← (stub) XR / AEGENTIS-X adapter
    └── exchange/         ← (stub) Exchange adapter

data/
└── events.jsonl          ← Append-only event log (gitignored, persists on disk)
```

---

## Quick Start

```bash
npm install
npm start
```

---

## API

### `POST /intent`

Submit a command intent. The event is validated, routed, applied to state, and persisted.

```bash
curl -X POST http://localhost:8080/intent \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "robotics",
    "type": "MOVE_COMMAND",
    "entity_id": "robot-arm-01",
    "payload": { "approved": true, "force": 1, "action": "move", "position": [10, 20, 30] }
  }'
```

### `GET /state`

Returns the current world state snapshot (live projection of all applied events).

```bash
curl http://localhost:8080/state
```

### `GET /state/events`

Returns the in-memory event log for the current session (last 50 by default).

```bash
curl http://localhost:8080/state/events?limit=10
```

### `GET /health`

Liveness probe — returns version, uptime, event count, and store path.

```bash
curl http://localhost:8080/health
```

---

## Event Sourcing

Every accepted event is immediately appended to `data/events.jsonl` as a single JSON line:

```jsonl
{"event_id":"bfcc9438-...","timestamp":1782855560406,"domain":"robotics","type":"MOVE_COMMAND","entity_id":"robot-arm-01","payload":{...}}
```

On startup, `index.js` reads this file and replays all events through the projector to rebuild world state. This gives you:

- **Crash recovery** — state survives process restarts
- **Audit trail** — every command is permanently recorded
- **Deterministic replay** — state can always be reconstructed from scratch
- **Debuggability** — inspect the log to understand exactly what happened and when

---

## Roadmap

| Milestone | Status |
|-----------|--------|
| v0.1 — Event pipeline (emit → validate → route → apply) | ✅ Complete |
| v0.2 — Persistent event store + replay + structured layout | ✅ Complete |
| v0.3 — ROS2 adapter (real robot commands) | Planned |
| v0.4 — Treasury adapter | Planned |
| v0.5 — XR / AEGENTIS-X adapter | Planned |
| v1.0 — Federation (multi-node WorldMonitor sync) | Planned |
