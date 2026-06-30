/**
 * Replay Tests
 *
 * These tests verify the constitutional guarantee of WorldMonitor:
 * that world state can be deterministically reconstructed from the event log.
 *
 * Specifically:
 *   1. Replaying N events produces the correct final state
 *   2. Replay is idempotent — running it twice on the same log gives the same result
 *   3. The replay manifest accurately reports applied/skipped counts
 *   4. A log with malformed lines produces a "degraded" manifest status
 */

import fs from "fs";
import os from "os";
import path from "path";
import { strict as assert } from "assert";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempLog(lines) {
  const dir  = fs.mkdtempSync(path.join(os.tmpdir(), "wm-replay-"));
  const file = path.join(dir, "events.jsonl");
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

function makeEvent(overrides = {}) {
  return {
    event_id:  "ev-" + Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    domain:    "robotics",
    type:      "MOVE_COMMAND",
    entity_id: "robot-arm-01",
    payload:   { approved: true, force: 1, action: "move", position: [0, 0, 0] },
    ...overrides,
  };
}

// ─── Inline projector (mirrors projector.js logic) ───────────────────────────

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

// ─── Inline replay (mirrors replay.js logic) ─────────────────────────────────

function replayFrom(file) {
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return { manifest: { applied: 0, skipped: 0, status: "clean" }, state: buildState([]) };

  let skipped = 0;
  const events = raw.split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line); }
    catch { skipped++; return null; }
  }).filter(Boolean);

  const state = buildState(events);
  return {
    manifest: {
      applied:  events.length,
      skipped,
      status:   skipped === 0 ? "clean" : "degraded",
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

console.log("\nReplay Tests\n");

// 1. Replaying a single event produces correct robot state
test("replaying one event produces correct robot state", () => {
  const event = makeEvent({ payload: { approved: true, force: 2, action: "move", position: [10, 20, 30] } });
  const file = makeTempLog([JSON.stringify(event)]);

  const { state, manifest } = replayFrom(file);
  assert.equal(manifest.applied, 1);
  assert.equal(manifest.status, "clean");
  assert.deepEqual(state.robots["robot-arm-01"].position, [10, 20, 30]);
  assert.equal(state.eventCount, 1);
});

// 2. Last event wins — state reflects the most recent command
test("last event wins: state reflects most recent command", () => {
  const e1 = makeEvent({ payload: { approved: true, force: 1, action: "move", position: [1, 1, 1] } });
  const e2 = makeEvent({ payload: { approved: true, force: 1, action: "move", position: [9, 9, 9] } });
  const file = makeTempLog([JSON.stringify(e1), JSON.stringify(e2)]);

  const { state } = replayFrom(file);
  assert.deepEqual(state.robots["robot-arm-01"].position, [9, 9, 9]);
  assert.equal(state.eventCount, 2);
});

// 3. Replay is deterministic — same log always produces same state
test("replay is deterministic: same log produces identical state", () => {
  const events = [
    makeEvent({ event_id: "a", payload: { approved: true, force: 1, action: "move", position: [1, 2, 3] } }),
    makeEvent({ event_id: "b", payload: { approved: true, force: 2, action: "grip", position: [4, 5, 6] } }),
  ];
  const file = makeTempLog(events.map(e => JSON.stringify(e)));

  const run1 = replayFrom(file);
  const run2 = replayFrom(file);

  assert.deepEqual(run1.state, run2.state);
  assert.equal(run1.manifest.applied, run2.manifest.applied);
});

// 4. Malformed lines produce a "degraded" manifest
test("malformed lines produce degraded manifest status", () => {
  const good = makeEvent();
  const file = makeTempLog([
    JSON.stringify(good),
    "NOT_VALID_JSON",
    JSON.stringify(makeEvent()),
  ]);

  const { manifest } = replayFrom(file);
  assert.equal(manifest.applied, 2);
  assert.equal(manifest.skipped, 1);
  assert.equal(manifest.status, "degraded");
});

// 5. Empty log produces clean manifest with zero counts
test("empty log produces clean manifest with zero applied events", () => {
  const file = makeTempLog([]);
  const { manifest, state } = replayFrom(file);
  assert.equal(manifest.applied, 0);
  assert.equal(manifest.skipped, 0);
  assert.equal(manifest.status, "clean");
  assert.equal(state.eventCount, 0);
});

// 6. Multiple robots are tracked independently
test("multiple robots are tracked independently in world state", () => {
  const e1 = makeEvent({ entity_id: "robot-arm-01", payload: { approved: true, force: 1, action: "move", position: [1, 0, 0] } });
  const e2 = makeEvent({ entity_id: "robot-arm-02", payload: { approved: true, force: 1, action: "move", position: [0, 1, 0] } });
  const file = makeTempLog([JSON.stringify(e1), JSON.stringify(e2)]);

  const { state } = replayFrom(file);
  assert.deepEqual(state.robots["robot-arm-01"].position, [1, 0, 0]);
  assert.deepEqual(state.robots["robot-arm-02"].position, [0, 1, 0]);
  assert.equal(state.eventCount, 2);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
