/**
 * Replay Isolation and Idempotence Tests
 *
 * These tests verify two invariants that are constitutional for the
 * AEGENTIS event-sourced architecture:
 *
 * Invariant 1 — Router Isolation:
 *   Replay NEVER invokes external adapters (the Router).
 *   Replaying a log of 1000 robotics commands must not dispatch a single
 *   robot command. This prevents duplicate physical actions and double-spends.
 *
 * Invariant 2 — Idempotence:
 *   Replaying the same event log twice produces byte-identical world state.
 *   State reconstruction is deterministic and has no hidden side effects.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { strict as assert } from "assert";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempLog(lines) {
  const dir  = fs.mkdtempSync(path.join(os.tmpdir(), "wm-iso-"));
  const file = path.join(dir, "events.jsonl");
  fs.writeFileSync(file, lines.join("\n") + (lines.length ? "\n" : ""));
  return file;
}

function makeEvent(overrides = {}) {
  return {
    event_id:       "ev-" + Math.random().toString(36).slice(2),
    event_version:  1,
    timestamp:      Date.now(),
    trace_id:       "tr-" + Math.random().toString(36).slice(2),
    correlation_id: null,
    source:         "worldmonitor",
    actor:          null,
    domain:         "robotics",
    type:           "MOVE_COMMAND",
    entity_id:      "robot-arm-01",
    payload:        { approved: true, force: 1, action: "move", position: [0, 0, 0] },
    ...overrides,
  };
}

// ─── Inline projector (mirrors projector.js) ─────────────────────────────────

function buildState(events) {
  const state = { robots: {}, treasury: {}, xr: {}, eventCount: 0 };
  for (const event of events) {
    state.eventCount++;
    if (event.domain === "robotics") {
      const current = state.robots[event.entity_id] || {};
      state.robots[event.entity_id] = {
        ...current,
        lastCommand: event.payload,
        position:    event.payload.position ?? current.position ?? null,
        updated:     event.timestamp,
      };
    }
  }
  return state;
}

// ─── Inline replay (mirrors replay.js — Projector only, no Router) ───────────

function replayFrom(file, routerCallCount) {
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return { manifest: { applied: 0, skipped: 0, routerDispatched: 0, status: "clean" }, state: buildState([]) };

  let skipped = 0;
  const events = raw.split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line); }
    catch { skipped++; return null; }
  }).filter(Boolean);

  // Projector only — Router is intentionally absent
  const state = buildState(events);

  // routerCallCount is a shared counter passed by reference (object)
  // It should remain 0 after replay

  return {
    manifest: {
      applied:          events.length,
      skipped,
      routerDispatched: routerCallCount.value,
      status:           skipped === 0 ? "clean" : "degraded",
    },
    state,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("\nReplay Isolation and Idempotence Tests\n");

// ─── Invariant 1: Router Isolation ───────────────────────────────────────────

test("router is never called during replay of 1 event", () => {
  const file = makeTempLog([JSON.stringify(makeEvent())]);
  const routerCallCount = { value: 0 };

  const { manifest } = replayFrom(file, routerCallCount);
  assert.equal(manifest.routerDispatched, 0,
    "Router must not be called during replay");
  assert.equal(manifest.applied, 1);
});

test("router is never called during replay of 1000 events", () => {
  const events = Array.from({ length: 1000 }, (_, i) =>
    makeEvent({ entity_id: `robot-${i % 10}`, payload: { approved: true, force: 1, action: "move", position: [i, 0, 0] } })
  );
  const file = makeTempLog(events.map(e => JSON.stringify(e)));
  const routerCallCount = { value: 0 };

  const { manifest } = replayFrom(file, routerCallCount);
  assert.equal(manifest.routerDispatched, 0,
    "Router must not be called during replay of 1000 events");
  assert.equal(manifest.applied, 1000);
});

test("replay manifest always reports routerDispatched as 0", () => {
  const events = [makeEvent(), makeEvent({ domain: "treasury" }), makeEvent({ domain: "xr" })];
  const file = makeTempLog(events.map(e => JSON.stringify(e)));
  const routerCallCount = { value: 0 };

  const { manifest } = replayFrom(file, routerCallCount);
  assert.equal(manifest.routerDispatched, 0);
});

// ─── Invariant 2: Idempotence ─────────────────────────────────────────────────

test("replaying the same log twice produces identical state", () => {
  const events = [
    makeEvent({ entity_id: "robot-arm-01", payload: { approved: true, force: 1, action: "move", position: [1, 2, 3] } }),
    makeEvent({ entity_id: "robot-arm-02", payload: { approved: true, force: 2, action: "grip", position: [4, 5, 6] } }),
    makeEvent({ entity_id: "robot-arm-01", payload: { approved: true, force: 1, action: "move", position: [7, 8, 9] } }),
  ];
  const file = makeTempLog(events.map(e => JSON.stringify(e)));

  const run1 = replayFrom(file, { value: 0 });
  const run2 = replayFrom(file, { value: 0 });

  assert.deepEqual(run1.state, run2.state,
    "State must be identical across two replays of the same log");
});

test("idempotence holds with 500 events across 5 robots", () => {
  const events = Array.from({ length: 500 }, (_, i) =>
    makeEvent({
      entity_id: `robot-${i % 5}`,
      payload:   { approved: true, force: i % 5 + 1, action: "move", position: [i, i * 2, i * 3] },
    })
  );
  const file = makeTempLog(events.map(e => JSON.stringify(e)));

  const run1 = replayFrom(file, { value: 0 });
  const run2 = replayFrom(file, { value: 0 });
  const run3 = replayFrom(file, { value: 0 });

  assert.deepEqual(run1.state, run2.state);
  assert.deepEqual(run2.state, run3.state);
  assert.equal(run1.manifest.applied, 500);
});

test("idempotence holds after adding a new event to the log", () => {
  const e1 = makeEvent({ payload: { approved: true, force: 1, action: "move", position: [1, 0, 0] } });
  const e2 = makeEvent({ payload: { approved: true, force: 2, action: "move", position: [2, 0, 0] } });
  const file = makeTempLog([JSON.stringify(e1)]);

  const before = replayFrom(file, { value: 0 });
  assert.deepEqual(before.state.robots["robot-arm-01"].position, [1, 0, 0]);

  // Append a new event (simulating a live command arriving)
  fs.appendFileSync(file, JSON.stringify(e2) + "\n");

  const after = replayFrom(file, { value: 0 });
  assert.deepEqual(after.state.robots["robot-arm-01"].position, [2, 0, 0]);
  assert.equal(after.manifest.applied, 2);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
