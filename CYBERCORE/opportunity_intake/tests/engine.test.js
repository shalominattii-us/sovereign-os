import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getIntakeStatus,
  ingestBatch,
  routeOpportunities,
  scoreOpportunities,
  verifyOpportunitySources,
} from "../src/engine.js";
import { evidenceInput } from "./fixtures.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const INTELLIGENCE_POLICY = path.resolve(TEST_DIR, "../policy/intelligence-policy-v1.json");
const COMMERCIALIZATION_POLICY = path.resolve(TEST_DIR, "../policy/commercialization-policy-v1.json");

async function withTempDirectory(fn) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aegentix-cybercore-"));
  try {
    await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function opportunity(overrides = {}) {
  return {
    title: "Deterministic Procurement",
    issuer: "Test Agency",
    opportunity_type: "procurement",
    procurement_type: "RFP",
    market_entry: "technology_partner",
    sector: "maritime domain awareness",
    identifier: "RFP-2026-001",
    publication_date: "2026-08-01",
    deadline: "2026-09-01",
    source_url: "https://example.gov/RFP-2026-001",
    source_checked_at: "2026-08-06T10:00:00.000Z",
    strategic_fit: "Tier 1",
    priority: "P0",
    revenue_path: "technology delivery contract",
    record_status: "active",
    ...overrides,
  };
}

async function writeBatch(baseDir, name, payload) {
  const inputFile = path.join(baseDir, name);
  await writeFile(inputFile, `${JSON.stringify(payload, null, 2)}\n`);
  return inputFile;
}

test("ingestion deduplicates amendments but cannot self-verify without evidence", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = await writeBatch(baseDir, "batch.json", {
      batch_id: "ENGINE-TEST-001",
      batch_date: "2026-08-06",
      opportunities: [
        opportunity(),
        opportunity({ deadline: "2026-10-01", record_status: "extended", lifecycle_note: "deadline extended" }),
      ],
    });

    const result = await ingestBatch({
      baseDir,
      inputFile,
      source: "test-suite",
      mode: "normalize_validate",
      authorization: "human_required",
    });

    assert.equal(result.manifest.status, "COMPLETED");
    assert.equal(result.manifest.summary.discovered, 1);
    assert.equal(result.manifest.summary.merged, 1);
    assert.equal(result.manifest.summary.verified, 0);
    assert.equal(result.manifest.summary.needs_source_verification, 2);

    const normalizedFiles = (await readdir(path.join(baseDir, "normalized"))).filter((file) => file.endsWith(".json"));
    assert.equal(normalizedFiles.length, 1);
    const normalized = JSON.parse(await readFile(path.join(baseDir, "normalized", normalizedFiles[0]), "utf8"));
    assert.equal(normalized.deadline, "2026-10-01");
    assert.equal(normalized.record_status, "extended");
    assert.equal(normalized.action_state, "DISCOVERED");
    assert.equal(normalized.validation.status, "NEEDS_SOURCE_VERIFICATION");

    const validatedFiles = (await readdir(path.join(baseDir, "validated"))).filter((file) => file.endsWith(".json"));
    assert.equal(validatedFiles.length, 0);
    const eventLines = (await readFile(path.join(baseDir, "events", "opportunity_events.jsonl"), "utf8"))
      .trim().split("\n").map(JSON.parse);
    assert.deepEqual(eventLines.map((event) => event.type), ["OPPORTUNITY_DISCOVERED", "OPPORTUNITY_MERGED"]);
  });
});

test("scalar source enrichment preserves identity but still requires authoritative evidence", async () => {
  await withTempDirectory(async (baseDir) => {
    const firstInput = await writeBatch(baseDir, "discovery.json", {
      batch_id: "ENGINE-TEST-ENRICH-001",
      opportunities: [opportunity({ identifier: null, deadline: null, source_url: null, source_checked_at: null })],
    });
    const firstRun = await ingestBatch({ baseDir, inputFile: firstInput, source: "test-suite" });
    const originalId = firstRun.records[0].id;

    const enrichmentInput = await writeBatch(baseDir, "enrichment.json", {
      batch_id: "ENGINE-TEST-ENRICH-002",
      opportunities: [opportunity()],
    });
    const secondRun = await ingestBatch({ baseDir, inputFile: enrichmentInput, source: "test-suite" });

    assert.equal(secondRun.manifest.summary.merged, 1);
    assert.equal(secondRun.records[0].id, originalId);
    assert.equal(secondRun.records[0].identifier, "RFP-2026-001");
    assert.equal(secondRun.records[0].validation.status, "NEEDS_SOURCE_VERIFICATION");
    assert.ok(secondRun.records[0].validation.missing_fields.includes("source_evidence"));
    assert.equal(secondRun.records[0].action_state, "DISCOVERED");
  });
});

test("verify, score, and route produce a human-review record without executing a Treasury handoff", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = await writeBatch(baseDir, "batch.json", {
      batch_id: "ENGINE-PIPELINE-001",
      opportunities: [opportunity({ source_url: null, source_checked_at: null })],
    });
    await ingestBatch({ baseDir, inputFile, source: "test-suite" });

    const evidenceFile = path.join(baseDir, "evidence.json");
    await writeFile(evidenceFile, `${JSON.stringify({
      batch_id: "ENGINE-EVIDENCE-001",
      evidence: [evidenceInput({
        record_title: "Deterministic Procurement",
        official_title: "Deterministic Procurement",
        identifier: "RFP-2026-001",
        deadline: "2026-09-01",
      })],
    }, null, 2)}\n`);

    const verification = await verifyOpportunitySources({ baseDir, evidenceFile });
    assert.equal(verification.manifest.summary.verified, 1);
    assert.equal(verification.records[0].action_state, "VALIDATED");

    const scoring = await scoreOpportunities({
      baseDir,
      policyFile: INTELLIGENCE_POLICY,
      recordSelector: "all",
    });
    assert.equal(scoring.manifest.summary.scored, 1);
    assert.equal(scoring.records[0].intelligence.status, "SCORED");
    assert.equal(scoring.records[0].action_state, "STRATEGIC_MATCHED");

    const routing = await routeOpportunities({
      baseDir,
      policyFile: COMMERCIALIZATION_POLICY,
      recordSelector: "all",
    });
    assert.equal(routing.manifest.summary.ready_for_human_review, 1);
    assert.equal(routing.manifest.summary.treasury_handoffs_executed, 0);
    assert.equal(routing.records[0].action_state, "HUMAN_REVIEW_REQUIRED");
    assert.equal(routing.records[0].commercialization.treasury_labs_handoff.status, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(routing.records[0].commercialization.treasury_labs_handoff.automatic_dispatch, false);

    const commercialFiles = (await readdir(path.join(baseDir, "commercial_pipeline")))
      .filter((file) => file.endsWith(".json"));
    assert.equal(commercialFiles.length, 1);
    const eventTypes = (await readFile(path.join(baseDir, "events", "opportunity_events.jsonl"), "utf8"))
      .trim().split("\n").map(JSON.parse).map((event) => event.type);
    assert.deepEqual(eventTypes, [
      "OPPORTUNITY_DISCOVERED",
      "OPPORTUNITY_SOURCE_VERIFIED",
      "OPPORTUNITY_INTELLIGENCE_SCORED",
      "OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED",
    ]);

    const status = await getIntakeStatus(baseDir);
    assert.equal(status.by_state.HUMAN_REVIEW_REQUIRED, 1);
    assert.equal(status.by_temporal_status.OPEN, 1);
    assert.equal(status.by_commercial_status.READY_FOR_HUMAN_REVIEW, 1);
  });
});

test("unverified records are normalized without false validation claims", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = await writeBatch(baseDir, "batch.json", {
      batch_id: "ENGINE-TEST-002",
      opportunities: [opportunity({ identifier: null, source_url: null, source_checked_at: null })],
    });
    const result = await ingestBatch({ baseDir, inputFile, source: "test-suite" });
    assert.equal(result.records[0].validation.status, "NEEDS_SOURCE_VERIFICATION");
    assert.equal(result.records[0].action_state, "DISCOVERED");
    assert.equal(result.manifest.summary.needs_source_verification, 1);
  });
});

test("unsupported modes and authorization policies fail closed", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = await writeBatch(baseDir, "batch.json", {
      batch_id: "ENGINE-TEST-003",
      opportunities: [opportunity()],
    });
    await assert.rejects(
      ingestBatch({ baseDir, inputFile, mode: "auto_submit", authorization: "human_required" }),
      /Only normalize_validate mode is supported/,
    );
    await assert.rejects(
      ingestBatch({ baseDir, inputFile, mode: "normalize_validate", authorization: "automatic" }),
      /requires human_required authorization/,
    );
  });
});
