import test from "node:test";
import assert from "node:assert/strict";
import { scoreOpportunity } from "../src/intelligence.js";
import {
  discoveredRecord,
  intelligencePolicy,
  scoredRecord,
  verifiedRecord,
} from "./fixtures.js";

test("strategic intelligence score is deterministic and fully explained", () => {
  const verified = verifiedRecord();
  const first = scoreOpportunity(verified, intelligencePolicy, {
    timestamp: "2026-08-06T12:06:00.000Z",
  });
  const second = scoreOpportunity(verified, intelligencePolicy, {
    timestamp: "2026-08-06T12:06:00.000Z",
  });

  assert.deepEqual(first.intelligence.dimensions, second.intelligence.dimensions);
  assert.equal(first.intelligence.score, second.intelligence.score);
  assert.equal(first.intelligence.policy_version, "1.0.0");
  assert.ok(first.intelligence.explanation.length >= 5);
  assert.equal(first.action_state, "STRATEGIC_MATCHED");
});

test("reported score equals the versioned weighted formula", () => {
  const record = scoredRecord();
  const dimensions = record.intelligence.dimensions;
  const weights = record.intelligence.weights;
  const expected = Math.round((
    dimensions.sector_fit * weights.sector_fit
    + dimensions.revenue_probability * weights.revenue_probability
    + dimensions.funding_probability * weights.funding_probability
    + (100 - dimensions.implementation_complexity) * weights.implementation_feasibility
    + dimensions.strategic_alignment * weights.strategic_alignment
  ) * 10) / 10;
  assert.equal(record.intelligence.score, expected);
  assert.equal(record.strategic_score, expected);
  assert.equal(record.revenue_probability, dimensions.revenue_probability / 100);
});

test("unverified opportunities cannot be scored", () => {
  assert.throws(
    () => scoreOpportunity(discoveredRecord(), intelligencePolicy),
    /requires a strictly VERIFIED opportunity/,
  );
});

test("rescoring uses preserved declared signals instead of its prior recommendation", () => {
  const first = scoredRecord();
  const second = scoreOpportunity(first, intelligencePolicy, {
    timestamp: "2026-08-06T12:08:00.000Z",
  });
  assert.equal(second.intelligence.input_signals.declared_priority, "P0");
  assert.equal(second.intelligence.input_signals.declared_strategic_tier, "Tier 1");
  assert.equal(second.intelligence.score, first.intelligence.score);
});

test("closed opportunities receive zeroed near-term revenue and funding dimensions", () => {
  const closed = verifiedRecord({}, {
    classification: "HISTORICAL",
    deadline: "2026-07-01",
    official_status: "closed",
  });
  const scored = scoreOpportunity(closed, intelligencePolicy);
  assert.equal(scored.temporal_status, "CLOSED");
  assert.equal(scored.intelligence.dimensions.revenue_probability, 22);
  assert.equal(scored.intelligence.dimensions.funding_probability, 6);
});
