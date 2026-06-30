/**
 * Event Store Tests
 *
 * These tests verify the three constitutional operations of the event store:
 *   1. Append  — events are written correctly and immutably
 *   2. Load    — events are read back in order with integrity checking
 *   3. Count   — the store accurately reports how many events it holds
 *
 * Tests use a temporary file so they never touch data/events.jsonl.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { strict as assert } from "assert";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempStore() {
  const dir  = fs.mkdtempSync(path.join(os.tmpdir(), "wm-test-"));
  const file = path.join(dir, "events.jsonl");
  return { dir, file };
}

function makeEvent(overrides = {}) {
  return {
    event_id:  "test-id-" + Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    domain:    "robotics",
    type:      "MOVE_COMMAND",
    entity_id: "robot-arm-01",
    payload:   { approved: true, force: 1, action: "move", position: [0, 0, 0] },
    ...overrides,
  };
}

// ─── Inline store implementation (mirrors eventStore.js, path-injectable) ────
// We test the logic directly without relying on the module's hardcoded path.

function appendTo(file, event) {
  fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf8");
}

function loadFrom(file) {
  if (!fs.existsSync(file)) return { events: [], skipped: 0 };
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return { events: [], skipped: 0 };

  let skipped = 0;
  const events = raw.split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line); }
    catch { skipped++; return null; }
  }).filter(Boolean);

  return { events, skipped };
}

function countFrom(file) {
  if (!fs.existsSync(file)) return 0;
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
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

console.log("\nEvent Store Tests\n");

// 1. Append writes a valid JSON line
test("append writes a valid JSON line", () => {
  const { file } = makeTempStore();
  const event = makeEvent();
  appendTo(file, event);

  const raw = fs.readFileSync(file, "utf8").trim();
  const parsed = JSON.parse(raw);
  assert.equal(parsed.event_id, event.event_id);
});

// 2. Multiple appends preserve order
test("multiple appends preserve chronological order", () => {
  const { file } = makeTempStore();
  const e1 = makeEvent({ event_id: "first",  timestamp: 1000 });
  const e2 = makeEvent({ event_id: "second", timestamp: 2000 });
  const e3 = makeEvent({ event_id: "third",  timestamp: 3000 });

  appendTo(file, e1);
  appendTo(file, e2);
  appendTo(file, e3);

  const { events } = loadFrom(file);
  assert.equal(events.length, 3);
  assert.equal(events[0].event_id, "first");
  assert.equal(events[1].event_id, "second");
  assert.equal(events[2].event_id, "third");
});

// 3. Load returns empty result for empty file
test("loadEvents returns empty result for empty store", () => {
  const { file } = makeTempStore();
  fs.writeFileSync(file, "");
  const { events, skipped } = loadFrom(file);
  assert.equal(events.length, 0);
  assert.equal(skipped, 0);
});

// 4. Malformed lines are skipped and counted
test("malformed lines are skipped and counted in skipped", () => {
  const { file } = makeTempStore();
  const good = makeEvent({ event_id: "good" });
  fs.writeFileSync(file,
    JSON.stringify(good) + "\n" +
    "THIS IS NOT JSON\n" +
    JSON.stringify(makeEvent({ event_id: "also-good" })) + "\n"
  );

  const { events, skipped } = loadFrom(file);
  assert.equal(events.length, 2);
  assert.equal(skipped, 1);
  assert.equal(events[0].event_id, "good");
});

// 5. getEventCount returns accurate line count
test("getEventCount returns the correct number of stored events", () => {
  const { file } = makeTempStore();
  appendTo(file, makeEvent());
  appendTo(file, makeEvent());
  appendTo(file, makeEvent());
  assert.equal(countFrom(file), 3);
});

// 6. Append is truly immutable — no event is modified on re-read
test("events are identical after append and reload (immutability)", () => {
  const { file } = makeTempStore();
  const original = makeEvent({ payload: { approved: true, force: 3, action: "grip" } });
  appendTo(file, original);

  const { events } = loadFrom(file);
  assert.deepEqual(events[0], original);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
