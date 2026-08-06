import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuthorization,
  assertAuthorizedExternalAction,
  createAuthorization,
} from "../src/authorization.js";
import { mergeOpportunity, normalizeOpportunity } from "../src/normalizer.js";
import { ACTION_STATES } from "../src/constants.js";

function reviewReadyRecord() {
  return normalizeOpportunity({
    title: "Human-Gated Opportunity",
    issuer: "Test Agency",
    opportunity_type: "procurement",
    identifier: "CSO-42",
    deadline: "2026-12-01",
    source_url: "https://example.gov/CSO-42",
    source_checked_at: "2026-08-06T12:00:00.000Z",
    strategic_fit: "Tier 1",
    priority: "P0",
    revenue_path: "technology prototype contract",
    record_status: "active",
  }, {
    source: "test-suite",
    batchId: "AUTH-TEST-001",
    timestamp: "2026-08-06T12:05:00.000Z",
  });
}

test("authorization rejects non-human actors", () => {
  const record = reviewReadyRecord();
  assert.equal(record.action_state, ACTION_STATES.HUMAN_REVIEW_REQUIRED);
  assert.throws(() => createAuthorization(record, {
    action: "bid",
    authorized_by: "agent:planner",
    reason: "automated decision",
  }, { timestamp: "2026-08-06T12:10:00.000Z" }), /human:<identifier>/);
});

test("scoped human authorization advances state but executes no external action", () => {
  const record = reviewReadyRecord();
  const artifact = createAuthorization(record, {
    action: "bid",
    authorized_by: "human:reviewer-001",
    reason: "Reviewed compliance and approved bid preparation",
    ticket_reference: "DECISION-001",
    expires_at: "2026-08-07T12:10:00.000Z",
  }, { timestamp: "2026-08-06T12:10:00.000Z" });
  const authorized = applyAuthorization(record, artifact);

  assert.equal(authorized.action_state, ACTION_STATES.AUTHORIZED_ACTION);
  assert.equal(authorized.authorization.approved_action, "bid");
  assert.equal(authorized.authorization.authorization_id, artifact.authorization_id);
  assert.equal(
    assertAuthorizedExternalAction(authorized, artifact, "bid", {
      timestamp: "2026-08-06T12:11:00.000Z",
    }),
    true,
  );
});

test("authorization scope and expiry are enforced", () => {
  const record = reviewReadyRecord();
  const artifact = createAuthorization(record, {
    action: "external_communication",
    authorized_by: "human:reviewer-002",
    reason: "Approved one communication",
    expires_at: "2026-08-06T13:00:00.000Z",
  }, { timestamp: "2026-08-06T12:10:00.000Z" });
  const authorized = applyAuthorization(record, artifact);

  assert.throws(
    () => assertAuthorizedExternalAction(authorized, artifact, "contract", {
      timestamp: "2026-08-06T12:20:00.000Z",
    }),
    /outside authorization scope/,
  );
  assert.throws(
    () => assertAuthorizedExternalAction(authorized, artifact, "external_communication", {
      timestamp: "2026-08-06T13:00:00.000Z",
    }),
    /expired/,
  );
});

test("material amendments revoke prior authorization and return the record to human review", () => {
  const record = reviewReadyRecord();
  const artifact = createAuthorization(record, {
    action: "bid",
    authorized_by: "human:reviewer-004",
    reason: "Approved original bid",
  }, { timestamp: "2026-08-06T12:10:00.000Z" });
  const authorized = applyAuthorization(record, artifact);
  const amendedInput = normalizeOpportunity({
    title: authorized.title,
    issuer: authorized.issuer,
    opportunity_type: authorized.type,
    identifier: authorized.identifier,
    deadline: "2027-01-15",
    source_url: authorized.source.source_url,
    source_checked_at: "2026-08-06T13:00:00.000Z",
    strategic_fit: authorized.strategic_fit,
    priority: authorized.priority,
    revenue_path: authorized.revenue_path,
    record_status: "extended",
  }, {
    source: "test-suite",
    batchId: "AUTH-TEST-002",
    timestamp: "2026-08-06T13:05:00.000Z",
  });
  const amended = mergeOpportunity(authorized, amendedInput, {
    batchId: "AUTH-TEST-002",
    timestamp: "2026-08-06T13:05:00.000Z",
    mergeReason: "deadline extension",
  });

  assert.equal(amended.action_state, ACTION_STATES.HUMAN_REVIEW_REQUIRED);
  assert.equal(amended.authorization.status, "PENDING");
  assert.equal(amended.authorization.authorization_id, null);
  assert.throws(
    () => assertAuthorizedExternalAction(amended, artifact, "bid", {
      timestamp: "2026-08-06T13:06:00.000Z",
    }),
    /not in AUTHORIZED_ACTION/,
  );
});

test("tampered authorization artifacts fail integrity checks", () => {
  const record = reviewReadyRecord();
  const artifact = createAuthorization(record, {
    action: "registration",
    authorized_by: "human:reviewer-003",
    reason: "Approved registration",
  }, { timestamp: "2026-08-06T12:10:00.000Z" });
  const authorized = applyAuthorization(record, artifact);
  const tampered = { ...artifact, action: "financial_commitment" };

  assert.throws(
    () => assertAuthorizedExternalAction(authorized, tampered, "financial_commitment", {
      timestamp: "2026-08-06T12:20:00.000Z",
    }),
    /integrity check failed/,
  );
});
