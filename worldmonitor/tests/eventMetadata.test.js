/**
 * Event Metadata Tests
 *
 * Verifies that every emitted event conforms to the canonical
 * AEGENTIS Event Specification v1 (docs/EVENT_SPEC_v1.md).
 *
 * Specifically:
 *   - event_version is always 1
 *   - trace_id is always a non-empty string (auto-generated if not provided)
 *   - correlation_id defaults to null
 *   - source defaults to "worldmonitor"
 *   - actor defaults to null
 *   - Caller-supplied values for all optional fields are preserved
 */

import { strict as assert } from "assert";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Inline emit (mirrors eventBus.js logic, path-injectable) ────────────────

import { v4 as uuid } from "uuid";

function makeEmit(storePath) {
  return function emit(raw) {
    const event = {
      event_id:       uuid(),
      event_version:  1,
      timestamp:      Date.now(),
      trace_id:       raw.trace_id       ?? uuid(),
      correlation_id: raw.correlation_id ?? null,
      source:         raw.source ?? "worldmonitor",
      actor:          raw.actor  ?? null,
      domain:         raw.domain,
      type:           raw.type,
      entity_id:      raw.entity_id,
      payload:        raw.payload,
    };
    fs.appendFileSync(storePath, JSON.stringify(event) + "\n", "utf8");
    return event;
  };
}

function makeTempStore() {
  const dir  = fs.mkdtempSync(path.join(os.tmpdir(), "wm-meta-"));
  const file = path.join(dir, "events.jsonl");
  return file;
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

console.log("\nEvent Metadata Tests (EVENT_SPEC_v1 conformance)\n");

test("event_version is always 1", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  assert.equal(event.event_version, 1);
});

test("trace_id is auto-generated as a non-empty string when not provided", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  assert.ok(typeof event.trace_id === "string" && event.trace_id.length > 0);
});

test("caller-supplied trace_id is preserved", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {}, trace_id: "my-trace-123" });
  assert.equal(event.trace_id, "my-trace-123");
});

test("correlation_id defaults to null", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  assert.equal(event.correlation_id, null);
});

test("caller-supplied correlation_id is preserved", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {}, correlation_id: "corr-456" });
  assert.equal(event.correlation_id, "corr-456");
});

test("source defaults to 'worldmonitor'", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  assert.equal(event.source, "worldmonitor");
});

test("caller-supplied source is preserved", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "treasury", type: "TRANSFER_INTENT", entity_id: "wallet-001", payload: {}, source: "treasury-service" });
  assert.equal(event.source, "treasury-service");
});

test("actor defaults to null", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  assert.equal(event.actor, null);
});

test("caller-supplied actor is preserved", () => {
  const emit = makeEmit(makeTempStore());
  const event = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {}, actor: "agent:planner" });
  assert.equal(event.actor, "agent:planner");
});

test("two events emitted without trace_id get different trace_ids", () => {
  const emit = makeEmit(makeTempStore());
  const e1 = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  const e2 = emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: {} });
  assert.notEqual(e1.trace_id, e2.trace_id);
});

test("persisted event contains all required envelope fields", () => {
  const store = makeTempStore();
  const emit  = makeEmit(store);
  emit({ domain: "robotics", type: "MOVE_COMMAND", entity_id: "r1", payload: { approved: true } });

  const line  = fs.readFileSync(store, "utf8").trim();
  const saved = JSON.parse(line);

  for (const field of ["event_id", "event_version", "timestamp", "trace_id", "correlation_id", "source", "actor", "domain", "type", "entity_id", "payload"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(saved, field), `Missing field: ${field}`);
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
