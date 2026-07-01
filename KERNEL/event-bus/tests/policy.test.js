/**
 * Policy Engine Tests
 *
 * Verifies that the policy engine correctly enforces domain rules.
 * The policy engine is a pure function — no I/O, no side effects —
 * making it straightforward to test exhaustively.
 */

import { strict as assert } from "assert";
import { validate } from "../src/core/policyEngine.js";

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

console.log("\nPolicy Engine Tests\n");

// ─── Robotics domain ─────────────────────────────────────────────────────────

test("approved robotics command with safe force passes", () => {
  const result = validate({
    domain: "robotics",
    payload: { approved: true, force: 1 },
  });
  assert.equal(result.ok, true);
});

test("unapproved robotics command is rejected", () => {
  const result = validate({
    domain: "robotics",
    payload: { approved: false, force: 1 },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /approved/i);
});

test("missing approved field is rejected", () => {
  const result = validate({
    domain: "robotics",
    payload: { force: 1 },
  });
  assert.equal(result.ok, false);
});

test("force exactly at threshold (5) passes", () => {
  const result = validate({
    domain: "robotics",
    payload: { approved: true, force: 5 },
  });
  assert.equal(result.ok, true);
});

test("force above threshold (6) is rejected", () => {
  const result = validate({
    domain: "robotics",
    payload: { approved: true, force: 6 },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /force/i);
});

test("force of 0 passes (valid low-force command)", () => {
  const result = validate({
    domain: "robotics",
    payload: { approved: true, force: 0 },
  });
  assert.equal(result.ok, true);
});

test("missing payload is rejected for robotics domain", () => {
  const result = validate({
    domain: "robotics",
    payload: undefined,
  });
  assert.equal(result.ok, false);
});

// ─── Unknown domains ─────────────────────────────────────────────────────────

test("unknown domain passes (no rules defined yet)", () => {
  const result = validate({
    domain: "treasury",
    payload: { amount: 100 },
  });
  assert.equal(result.ok, true);
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
