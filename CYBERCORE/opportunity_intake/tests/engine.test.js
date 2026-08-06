import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ingestBatch, getIntakeStatus } from "../src/engine.js";

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

test("ingestion deduplicates amendments and writes durable workflow artifacts", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = path.join(baseDir, "batch.json");
    const payload = {
      batch_id: "ENGINE-TEST-001",
      batch_date: "2026-08-06",
      opportunities: [
        opportunity(),
        opportunity({ deadline: "2026-10-01", record_status: "extended", lifecycle_note: "deadline extended" }),
      ],
    };
    await writeFile(inputFile, `${JSON.stringify(payload, null, 2)}\n`);

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
    assert.equal(result.manifest.summary.verified, 2);

    const normalizedFiles = (await readdir(path.join(baseDir, "normalized"))).filter((file) => file.endsWith(".json"));
    assert.equal(normalizedFiles.length, 1);
    const normalized = JSON.parse(await readFile(path.join(baseDir, "normalized", normalizedFiles[0]), "utf8"));
    assert.equal(normalized.deadline, "2026-10-01");
    assert.equal(normalized.record_status, "extended");
    assert.equal(normalized.action_state, "HUMAN_REVIEW_REQUIRED");
    assert.equal(normalized.authorization.status, "PENDING");

    const eventLines = (await readFile(path.join(baseDir, "events", "opportunity_events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(eventLines.length, 2);
    assert.equal(eventLines[0].type, "OPPORTUNITY_DISCOVERED");
    assert.equal(eventLines[1].type, "OPPORTUNITY_MERGED");

    const status = await getIntakeStatus(baseDir);
    assert.equal(status.total_records, 1);
    assert.equal(status.by_state.HUMAN_REVIEW_REQUIRED, 1);
  });
});

test("source enrichment merges into the original record when identifier and deadline were initially unknown", async () => {
  await withTempDirectory(async (baseDir) => {
    const firstInput = path.join(baseDir, "discovery.json");
    await writeFile(firstInput, `${JSON.stringify({
      batch_id: "ENGINE-TEST-ENRICH-001",
      opportunities: [opportunity({ identifier: null, deadline: null, source_url: null, source_checked_at: null })],
    }, null, 2)}\n`);
    const firstRun = await ingestBatch({
      baseDir,
      inputFile: firstInput,
      source: "test-suite",
      authorization: "human_required",
    });
    const originalId = firstRun.records[0].id;
    assert.equal(firstRun.records[0].action_state, "DISCOVERED");

    const enrichmentInput = path.join(baseDir, "enrichment.json");
    await writeFile(enrichmentInput, `${JSON.stringify({
      batch_id: "ENGINE-TEST-ENRICH-002",
      opportunities: [opportunity()],
    }, null, 2)}\n`);
    const secondRun = await ingestBatch({
      baseDir,
      inputFile: enrichmentInput,
      source: "test-suite",
      authorization: "human_required",
    });

    assert.equal(secondRun.manifest.summary.discovered, 0);
    assert.equal(secondRun.manifest.summary.merged, 1);
    assert.equal(secondRun.records[0].id, originalId);
    assert.equal(secondRun.records[0].identifier, "RFP-2026-001");
    assert.equal(secondRun.records[0].validation.status, "VERIFIED");
    assert.equal(secondRun.records[0].action_state, "HUMAN_REVIEW_REQUIRED");
    const normalizedFiles = (await readdir(path.join(baseDir, "normalized"))).filter((file) => file.endsWith(".json"));
    assert.equal(normalizedFiles.length, 1);
  });
});

test("unverified records are normalized without false validation claims", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = path.join(baseDir, "batch.json");
    await writeFile(inputFile, `${JSON.stringify({
      batch_id: "ENGINE-TEST-002",
      opportunities: [opportunity({ identifier: null, source_url: null, source_checked_at: null })],
    }, null, 2)}\n`);

    const result = await ingestBatch({
      baseDir,
      inputFile,
      source: "test-suite",
      authorization: "human_required",
    });
    assert.equal(result.records[0].validation.status, "NEEDS_SOURCE_VERIFICATION");
    assert.equal(result.records[0].action_state, "DISCOVERED");
    assert.equal(result.manifest.summary.needs_source_verification, 1);
  });
});

test("unsupported modes and authorization policies fail closed", async () => {
  await withTempDirectory(async (baseDir) => {
    const inputFile = path.join(baseDir, "batch.json");
    await writeFile(inputFile, `${JSON.stringify({ batch_id: "ENGINE-TEST-003", opportunities: [opportunity()] })}\n`);

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
