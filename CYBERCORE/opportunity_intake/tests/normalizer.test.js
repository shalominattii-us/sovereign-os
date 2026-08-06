import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOpportunity, mergeOpportunity } from "../src/normalizer.js";
import { applySourceEvidence } from "../src/verification.js";
import { ACTION_STATES, VALIDATION_STATUS } from "../src/constants.js";
import { evidenceInput } from "./fixtures.js";

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
  assert.equal(first.schema_version, "2.0.0");
});

test("unverified source data remains DISCOVERED and explicitly requires evidence", () => {
  const record = normalizeOpportunity(baseInput(), context);
  assert.equal(record.validation.status, VALIDATION_STATUS.NEEDS_SOURCE_VERIFICATION);
  assert.equal(record.action_state, ACTION_STATES.DISCOVERED);
  assert.deepEqual(
    record.validation.missing_fields.sort(),
    ["source_checked_at", "source_evidence", "source_url"].sort(),
  );
});

test("populated source scalars alone cannot claim verification", () => {
  const record = normalizeOpportunity(baseInput({
    source_url: "https://example.gov/opportunity/RFP-001",
    source_checked_at: "2026-08-06T11:55:00.000Z",
  }), context);
  assert.equal(record.validation.status, VALIDATION_STATUS.NEEDS_SOURCE_VERIFICATION);
  assert.deepEqual(record.validation.missing_fields, ["source_evidence"]);
  assert.equal(record.action_state, ACTION_STATES.DISCOVERED);
});

test("authoritative evidence advances only to VALIDATED before scoring and routing", () => {
  const discovered = normalizeOpportunity(baseInput(), context);
  const verified = applySourceEvidence(discovered, evidenceInput({
    record_title: discovered.title,
    official_title: discovered.title,
    identifier: "RFP-001",
    deadline: "2026-09-30",
  }), { timestamp: "2026-08-06T12:05:00.000Z" });

  assert.equal(verified.validation.status, VALIDATION_STATUS.VERIFIED);
  assert.equal(verified.temporal_status, "OPEN");
  assert.equal(verified.action_state, ACTION_STATES.VALIDATED);
  assert.equal(verified.intelligence.status, "NOT_EVALUATED");
  assert.equal(verified.commercialization.status, "NOT_EVALUATED");
});

test("deadline amendments merge into stable identity and invalidate prior evidence-bound advancement", () => {
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
  assert.equal(merged.validation.status, VALIDATION_STATUS.NEEDS_SOURCE_VERIFICATION);
  assert.equal(merged.action_state, ACTION_STATES.DISCOVERED);
  assert.ok(merged.deduplication_aliases.includes(amendment.deduplication_key));
});
