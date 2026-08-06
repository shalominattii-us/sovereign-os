import test from "node:test";
import assert from "node:assert/strict";
import {
  applySourceEvidence,
  evaluateTemporalStatus,
  normalizeEvidenceItem,
} from "../src/verification.js";
import { discoveredRecord, evidenceInput } from "./fixtures.js";

test("specific authoritative evidence verifies issuer, identifier, deadline, and open status", () => {
  const record = applySourceEvidence(discoveredRecord(), evidenceInput(), {
    timestamp: "2026-08-06T12:05:00.000Z",
  });
  assert.equal(record.validation.status, "VERIFIED");
  assert.equal(record.validation.evidence_classification, "VERIFIED_ACTIVE");
  assert.equal(record.temporal_status, "OPEN");
  assert.equal(record.action_state, "VALIDATED");
  assert.equal(record.source_evidence.length, 1);
  assert.match(record.source_evidence[0].evidence_id, /^evidence_[a-f0-9]{24}$/);
});

test("program evidence is retained but cannot become a specific verified opportunity", () => {
  const record = applySourceEvidence(discoveredRecord(), evidenceInput({
    classification: "VERIFIED_PROGRAM",
    identifier: null,
    deadline: null,
    identifier_verified: false,
    deadline_verified: false,
    evidence_summary: "The source verifies a standing program but not one solicitation.",
  }), { timestamp: "2026-08-06T12:05:00.000Z" });

  assert.equal(record.validation.status, "NEEDS_SOURCE_VERIFICATION");
  assert.equal(record.temporal_status, "PROGRAM_ONLY");
  assert.equal(record.action_state, "DISCOVERED");
  assert.ok(record.validation.issues[0].includes("not a specific verifiable opportunity"));
});

test("historical and deadline-day evidence produce deterministic temporal status", () => {
  const historical = normalizeEvidenceItem(evidenceInput({
    classification: "HISTORICAL",
    deadline: "2027-01-01",
  }));
  assert.equal(evaluateTemporalStatus(historical, { timestamp: "2026-08-06T12:00:00.000Z" }), "CLOSED");

  const deadlineToday = normalizeEvidenceItem(evidenceInput({ deadline: "2026-08-06" }));
  assert.equal(evaluateTemporalStatus(deadlineToday, { timestamp: "2026-08-06T12:00:00.000Z" }), "DEADLINE_TODAY");
});

test("equivalent evidence produces a stable evidence ID", () => {
  const first = normalizeEvidenceItem(evidenceInput());
  const second = normalizeEvidenceItem(evidenceInput());
  assert.equal(first.evidence_id, second.evidence_id);
});

test("non-HTTPS evidence sources fail closed", () => {
  assert.throws(
    () => normalizeEvidenceItem(evidenceInput({ source_urls: ["http://example.gov/opportunity"] })),
    /must use HTTPS/,
  );
});
