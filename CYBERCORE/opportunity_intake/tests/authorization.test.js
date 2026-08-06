import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuthorization,
  assertAuthorizedExternalAction,
  createAuthorization,
} from "../src/authorization.js";
import { applySourceEvidence } from "../src/verification.js";
import { ACTION_STATES } from "../src/constants.js";
import { evidenceInput, reviewReadyRecord } from "./fixtures.js";

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
    reason: "Reviewed source evidence, score, and route; approved bid preparation",
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

test("new authoritative evidence revokes authorization and requires downstream reevaluation", () => {
  const record = reviewReadyRecord();
  const artifact = createAuthorization(record, {
    action: "bid",
    authorized_by: "human:reviewer-004",
    reason: "Approved original bid",
  }, { timestamp: "2026-08-06T12:10:00.000Z" });
  const authorized = applyAuthorization(record, artifact);

  const amended = applySourceEvidence(authorized, evidenceInput({
    retrieved_at: "2026-08-06T13:00:00.000Z",
    deadline: "2027-01-15",
    evidence_summary: "The authoritative source extended the deadline to January 15, 2027.",
  }), {
    timestamp: "2026-08-06T13:00:00.000Z",
    actor: "system:test-source-verification",
  });

  assert.equal(amended.action_state, ACTION_STATES.VALIDATED);
  assert.equal(amended.intelligence.status, "NOT_EVALUATED");
  assert.equal(amended.commercialization.status, "NOT_EVALUATED");
  assert.equal(amended.authorization.status, "PENDING");
  assert.equal(amended.authorization.authorization_id, null);
  assert.throws(
    () => assertAuthorizedExternalAction(amended, artifact, "bid", {
      timestamp: "2026-08-06T13:01:00.000Z",
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
