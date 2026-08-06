import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOpportunity, mergeOpportunity } from "../src/normalizer.js";
import { ACTION_STATES, VALIDATION_STATUS } from "../src/constants.js";

const context = {
  source: "test-suite",
  batchId: "TEST-BATCH-001",
  timestamp: "2026-08-06T12:00:00.000Z",
};

function baseInput(overrides = {}) {
  return {
    title: "Verified Technology Opportunity",
    issuer: "Test Agency",
    opportunity_type: "procurement",
    identifier: "RFP-001",
    deadline: "2026-09-30",
    strategic_fit: "Tier 1",
    priority: "P0",
    revenue_path: "technology delivery contract",
    record_status: "active",
    source_url: null,
    source_checked_at: null,
    ...overrides,
  };
}

test("normalization is deterministic for equivalent identity fields", () => {
  const first = normalizeOpportunity(baseInput(), context);
  const second = normalizeOpportunity(baseInput(), context);
  assert.equal(first.id, second.id);
  assert.equal(first.deduplication_key, second.deduplication_key);
  assert.equal(first.title_hash, second.title_hash);
});

test("unverified source data remains DISCOVERED and does not claim validation", () => {
  const record = normalizeOpportunity(baseInput(), context);
  assert.equal(record.validation.status, VALIDATION_STATUS.NEEDS_SOURCE_VERIFICATION);
  assert.equal(record.action_state, ACTION_STATES.DISCOVERED);
  assert.deepEqual(record.validation.missing_fields.sort(), ["source_checked_at", "source_url"].sort());
});

test("verified, classified records advance internally to HUMAN_REVIEW_REQUIRED", () => {
  const record = normalizeOpportunity(baseInput({
    source_url: "https://example.gov/opportunity/RFP-001",
    source_checked_at: "2026-08-06T11:55:00.000Z",
  }), context);
  assert.equal(record.validation.status, VALIDATION_STATUS.VERIFIED);
  assert.equal(record.action_state, ACTION_STATES.HUMAN_REVIEW_REQUIRED);
  assert.deepEqual(
    record.state_history.map((entry) => entry.to),
    [
      ACTION_STATES.DISCOVERED,
      ACTION_STATES.VALIDATED,
      ACTION_STATES.STRATEGIC_MATCHED,
      ACTION_STATES.REVENUE_PATH_IDENTIFIED,
      ACTION_STATES.HUMAN_REVIEW_REQUIRED,
    ],
  );
});

test("deadline amendments merge into the stable existing identity and retain the new key as an alias", () => {
  const existing = normalizeOpportunity(baseInput(), context);
  const amendment = normalizeOpportunity(baseInput({
    deadline: "2026-10-31",
    record_status: "extended",
  }), { ...context, batchId: "TEST-BATCH-002", timestamp: "2026-08-07T12:00:00.000Z" });
  assert.notEqual(amendment.id, existing.id);

  const merged = mergeOpportunity(existing, amendment, {
    batchId: "TEST-BATCH-002",
    timestamp: "2026-08-07T12:00:00.000Z",
    mergeReason: "deadline extension",
  });
  assert.equal(merged.id, existing.id);
  assert.equal(merged.deadline, "2026-10-31");
  assert.equal(merged.record_status, "extended");
  assert.ok(merged.deduplication_aliases.includes(amendment.deduplication_key));
});
