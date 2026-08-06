import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOpportunity } from "../src/normalizer.js";
import { applySourceEvidence } from "../src/verification.js";
import { scoreOpportunity } from "../src/intelligence.js";
import { routeOpportunity } from "../src/commercialization.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const intelligencePolicy = JSON.parse(readFileSync(
  path.resolve(TEST_DIR, "../policy/intelligence-policy-v1.json"),
  "utf8",
));
export const commercializationPolicy = JSON.parse(readFileSync(
  path.resolve(TEST_DIR, "../policy/commercialization-policy-v1.json"),
  "utf8",
));

export function opportunityInput(overrides = {}) {
  return {
    title: "Human-Gated Opportunity",
    issuer: "Test Agency",
    opportunity_type: "procurement",
    procurement_type: "CSO",
    market_entry: "technology_partner",
    sector: "maritime domain awareness",
    identifier: null,
    deadline: null,
    source_url: null,
    source_checked_at: null,
    strategic_fit: "Tier 1",
    priority: "P0",
    revenue_path: "technology prototype contract",
    record_status: "active",
    ...overrides,
  };
}

export function evidenceInput(overrides = {}) {
  return {
    record_title: "Human-Gated Opportunity",
    classification: "VERIFIED_ACTIVE",
    source_authority: "Test Agency Official Portal",
    source_urls: ["https://example.gov/opportunities/CSO-42"],
    retrieved_at: "2026-08-06T12:05:00.000Z",
    official_title: "Human-Gated Opportunity",
    issuer: "Test Agency",
    identifier: "CSO-42",
    publication_date: "2026-07-01",
    deadline: "2026-12-01",
    official_status: "active",
    value_amount: 5000000,
    value_currency: "USD",
    value_description: "$5,000,000 ceiling",
    eligibility: ["Registered eligible organizations"],
    submission_method: "Official proposal portal",
    issuer_verified: true,
    identifier_verified: true,
    deadline_verified: true,
    evidence_summary: "The official source directly verifies the issuer, identifier, and deadline.",
    confidence: 1,
    ...overrides,
  };
}

export function discoveredRecord(overrides = {}) {
  return normalizeOpportunity(opportunityInput(overrides), {
    source: "test-suite",
    batchId: "PIPELINE-TEST-001",
    timestamp: "2026-08-06T12:00:00.000Z",
  });
}

export function verifiedRecord(inputOverrides = {}, evidenceOverrides = {}) {
  const discovered = discoveredRecord(inputOverrides);
  return applySourceEvidence(discovered, evidenceInput(evidenceOverrides), {
    timestamp: "2026-08-06T12:05:00.000Z",
    actor: "system:test-source-verification",
  });
}

export function scoredRecord(inputOverrides = {}, evidenceOverrides = {}) {
  return scoreOpportunity(
    verifiedRecord(inputOverrides, evidenceOverrides),
    intelligencePolicy,
    { timestamp: "2026-08-06T12:06:00.000Z", actor: "system:test-intelligence" },
  );
}

export function reviewReadyRecord(inputOverrides = {}, evidenceOverrides = {}) {
  return routeOpportunity(
    scoredRecord(inputOverrides, evidenceOverrides),
    commercializationPolicy,
    { timestamp: "2026-08-06T12:07:00.000Z", actor: "system:test-routing" },
  );
}
