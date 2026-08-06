import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/core/policyEngine.js";
import { apply } from "../src/state/projector.js";
import { state } from "../src/state/worldState.js";

function resetCybercoreState() {
  state.cybercore = {
    opportunities: {},
    queues: { P0: [], P1: [], P2: [] },
    authorizations: {},
  };
  state.eventCount = 0;
}

function normalizedRecord() {
  return {
    id: "opp_0123456789abcdef01234567",
    deduplication_key: "agency|identifier|titlehash|2026-09-01",
    title: "Kernel Projection Opportunity",
    priority: "P0",
    action_state: "HUMAN_REVIEW_REQUIRED",
    authorization: { mode: "human_required", status: "PENDING" },
  };
}

test("Cybercore policy accepts normalized discovery events with human-required authorization", () => {
  const result = validate({
    domain: "cybercore",
    type: "OPPORTUNITY_DISCOVERED",
    payload: { record: normalizedRecord(), authorization_mode: "human_required" },
  });
  assert.deepEqual(result, { ok: true });
});

test("Cybercore policy rejects records that bypass human-required authorization", () => {
  const record = normalizedRecord();
  record.authorization.mode = "automatic";
  const result = validate({
    domain: "cybercore",
    type: "OPPORTUNITY_DISCOVERED",
    payload: { record, authorization_mode: "automatic" },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /human_required/);
});

test("Cybercore policy rejects non-human authorization actors", () => {
  const result = validate({
    domain: "cybercore",
    type: "OPPORTUNITY_AUTHORIZATION_RECORDED",
    payload: {
      authorization_mode: "human_required",
      action_state: "AUTHORIZED_ACTION",
      authorization: {
        authorization_id: "auth-test",
        artifact_hash: "a".repeat(64),
        authorized_by: "agent:planner",
      },
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /human actor/);
});

test("Cybercore projector creates records and priority queues deterministically", () => {
  resetCybercoreState();
  const record = normalizedRecord();
  apply({
    event_id: "evt-discovered",
    timestamp: 1786017600000,
    domain: "cybercore",
    type: "OPPORTUNITY_DISCOVERED",
    entity_id: record.id,
    payload: { record, authorization_mode: "human_required" },
  });

  assert.equal(state.cybercore.opportunities[record.id].title, record.title);
  assert.deepEqual(state.cybercore.queues.P0, [record.id]);
  assert.equal(state.eventCount, 1);
});

test("Cybercore projector records human authorization without external execution", () => {
  resetCybercoreState();
  const record = normalizedRecord();
  apply({
    event_id: "evt-discovered",
    timestamp: 1786017600000,
    domain: "cybercore",
    type: "OPPORTUNITY_DISCOVERED",
    entity_id: record.id,
    payload: { record, authorization_mode: "human_required" },
  });
  const authorization = {
    authorization_id: "auth-test-001",
    action: "bid",
    artifact_hash: "b".repeat(64),
    authorized_by: "human:reviewer-001",
    authorized_at: "2026-08-06T12:00:00.000Z",
    expires_at: "2026-08-07T12:00:00.000Z",
    mode: "human_required",
  };
  apply({
    event_id: "evt-authorized",
    timestamp: 1786017660000,
    domain: "cybercore",
    type: "OPPORTUNITY_AUTHORIZATION_RECORDED",
    entity_id: record.id,
    payload: { authorization, action_state: "AUTHORIZED_ACTION" },
  });

  assert.equal(state.cybercore.opportunities[record.id].action_state, "AUTHORIZED_ACTION");
  assert.equal(state.cybercore.opportunities[record.id].authorization.approved_action, "bid");
  assert.deepEqual(state.cybercore.authorizations[authorization.authorization_id], authorization);
});
