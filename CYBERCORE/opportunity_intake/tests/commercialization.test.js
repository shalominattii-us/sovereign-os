import test from "node:test";
import assert from "node:assert/strict";
import { routeOpportunity } from "../src/commercialization.js";
import { applySourceEvidence } from "../src/verification.js";
import { scoreOpportunity } from "../src/intelligence.js";
import {
  commercializationPolicy,
  discoveredRecord,
  evidenceInput,
  intelligencePolicy,
  scoredRecord,
  verifiedRecord,
} from "./fixtures.js";

test("active scored CSO routes to prototype demonstration and stops at human review", () => {
  const routed = routeOpportunity(scoredRecord(), commercializationPolicy, {
    timestamp: "2026-08-06T12:07:00.000Z",
  });
  assert.equal(routed.commercialization.status, "READY_FOR_HUMAN_REVIEW");
  assert.equal(routed.commercialization.primary_path, "prototype_demonstration");
  assert.equal(routed.action_state, "HUMAN_REVIEW_REQUIRED");
  assert.equal(routed.commercialization.treasury_labs_handoff.status, "HUMAN_APPROVAL_REQUIRED");
  assert.equal(routed.commercialization.treasury_labs_handoff.automatic_dispatch, false);
});

test("forecast opportunities are monitor-only and cannot reach Treasury Labs", () => {
  const forecast = verifiedRecord({}, {
    classification: "VERIFIED_FORECAST",
    official_status: "forecast",
  });
  const scored = scoreOpportunity(forecast, intelligencePolicy);
  const routed = routeOpportunity(scored, commercializationPolicy);
  assert.equal(routed.commercialization.status, "MONITOR_FORECAST");
  assert.equal(routed.action_state, "STRATEGIC_MATCHED");
  assert.equal(routed.commercialization.treasury_labs_handoff.status, "BLOCKED");
});

test("closed opportunities are routed to no-action monitoring", () => {
  const closed = verifiedRecord({}, {
    classification: "HISTORICAL",
    deadline: "2026-07-01",
    official_status: "closed",
  });
  const scored = scoreOpportunity(closed, intelligencePolicy);
  const routed = routeOpportunity(scored, commercializationPolicy);
  assert.equal(routed.commercialization.status, "CLOSED_NO_ACTION");
  assert.equal(routed.commercialization.treasury_labs_handoff.status, "BLOCKED");
  assert.notEqual(routed.action_state, "HUMAN_REVIEW_REQUIRED");
});

test("verified program categories remain discovery-only without scoring", () => {
  const program = applySourceEvidence(discoveredRecord(), evidenceInput({
    classification: "VERIFIED_PROGRAM",
    identifier: null,
    deadline: null,
    identifier_verified: false,
    deadline_verified: false,
    evidence_summary: "The source verifies a standing program category.",
  }));
  const routed = routeOpportunity(program, commercializationPolicy);
  assert.equal(routed.commercialization.status, "PROGRAM_DISCOVERY_ONLY");
  assert.equal(routed.action_state, "DISCOVERED");
  assert.equal(routed.commercialization.treasury_labs_handoff.status, "BLOCKED");
});

test("funding and consulting signals map to defensible commercial paths", () => {
  const grantScored = scoredRecord({
    opportunity_type: "funding",
    procurement_type: null,
    market_entry: "consortium_member",
    program_type: "research grant",
  });
  const grant = routeOpportunity(grantScored, commercializationPolicy);
  assert.ok(grant.commercialization.candidate_paths.includes("grant"));
  assert.ok(grant.commercialization.candidate_paths.includes("research_partnership"));

  const consultingScored = scoredRecord({
    procurement_type: "consulting",
    market_entry: "technology_partner",
    program_type: "supply-chain assessment consulting",
    revenue_path: "consulting engagement",
  });
  const consulting = routeOpportunity(consultingScored, commercializationPolicy);
  assert.equal(consulting.commercialization.primary_path, "consulting_engagement");
});
