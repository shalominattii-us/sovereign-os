import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { artifactHash } from "../../../CYBERCORE/opportunity_intake/src/canonical.js";
import { runFoundryOpportunityPipeline } from "../src/foundry.js";
import { DEFAULT_PATHS } from "../src/paths.js";

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function jsonFiles(directory) {
  return (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
}

test("complete Foundry pipeline executes five plugins and emits 22 maturity outputs with zero dispatch", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "aegentix-foundry-integration-"));
  const baseDir = path.join(workspace, "cybercore-runtime");
  const outputDir = path.join(workspace, "foundry-outputs");

  const run = await runFoundryOpportunityPipeline({
    baseDir,
    outputDir,
    inputFile: DEFAULT_PATHS.inputFile,
    evidenceFile: DEFAULT_PATHS.evidenceFile,
    intelligencePolicyFile: DEFAULT_PATHS.intelligencePolicyFile,
    commercializationPolicyFile: DEFAULT_PATHS.commercializationPolicyFile,
    evaluatedAt: "2026-08-06T17:32:17.000Z",
  });

  assert.equal(run.status, "COMPLETED");
  assert.equal(run.plugin_results.length, 5);
  assert.deepEqual(
    run.plugin_results.map((result) => result.status),
    ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED"],
  );
  assert.equal(run.evaluated_at, "2026-08-06T17:32:17.000Z");
  assert.equal(run.output.total_outputs, 22);
  assert.equal(run.output.human_review_required, 5);
  assert.equal(run.safety.automatic_dispatches, 0);
  assert.equal(run.safety.external_actions_executed, 0);
  assert.equal(run.safety.treasury_labs_handoffs_executed, 0);
  assert.equal(run.artifact_hash, artifactHash({ ...run, artifact_hash: null }));

  const persistedRun = await readJson(path.join(outputDir, "latest-run.json"));
  assert.equal(persistedRun.artifact_hash, artifactHash({ ...persistedRun, artifact_hash: null }));

  const index = await readJson(path.join(outputDir, "index.json"));
  assert.deepEqual(index.by_maturity, {
    CLOSED: 7,
    FORECAST_MONITOR: 1,
    HUMAN_REVIEW: 5,
    PROGRAM_DISCOVERY: 6,
    SOURCE_DISCOVERY: 3,
  });
  assert.equal(index.total_outputs, 22);
  assert.equal(index.files.length, 22);
  assert.equal(index.automatic_dispatches, 0);
  assert.equal(index.external_actions_executed, 0);
  assert.equal(index.artifact_hash, artifactHash({ ...index, artifact_hash: null }));

  const bundles = await Promise.all(index.files.map(({ relative_path: relativePath }) => readJson(path.join(outputDir, relativePath))));
  assert.equal(bundles.every((bundle) => bundle.artifact_hash === artifactHash({ ...bundle, artifact_hash: null })), true);
  assert.equal(bundles.every((bundle) => bundle.source.record_hash === artifactHash(bundle.record_snapshot)), true);
  assert.equal(bundles.every((bundle) => bundle.safety.external_action_executed === false), true);
  assert.equal(bundles.every((bundle) => bundle.treasury_labs.handoff_executed === false), true);

  const normalized = await jsonFiles(path.join(baseDir, "normalized"));
  const validated = await jsonFiles(path.join(baseDir, "validated"));
  const strategic = await jsonFiles(path.join(baseDir, "strategic_queue"));
  const commercial = await jsonFiles(path.join(baseDir, "commercial_pipeline"));
  const archived = await jsonFiles(path.join(baseDir, "archive"));
  const authorizations = await jsonFiles(path.join(baseDir, "authorizations"));
  const events = (await fs.readFile(path.join(baseDir, "events", "opportunity_events.jsonl"), "utf8")).trim().split("\n");

  assert.equal(normalized.length, 22);
  assert.equal(validated.length, 13);
  assert.equal(strategic.length, 13);
  assert.equal(commercial.length, 5);
  assert.equal(archived.length, 7);
  assert.equal(authorizations.length, 0);
  assert.equal(events.length, 79);
});

test("Foundry stops the chain and writes failure evidence when source verification is invalid", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "aegentix-foundry-failure-"));
  const baseDir = path.join(workspace, "cybercore-runtime");
  const outputDir = path.join(workspace, "foundry-outputs");
  const evidenceFile = path.join(workspace, "invalid-evidence.json");
  await fs.writeFile(evidenceFile, JSON.stringify({ schema_version: "invalid", evidence: [] }), "utf8");

  await assert.rejects(() => runFoundryOpportunityPipeline({
    baseDir,
    outputDir,
    inputFile: DEFAULT_PATHS.inputFile,
    evidenceFile,
    intelligencePolicyFile: DEFAULT_PATHS.intelligencePolicyFile,
    commercializationPolicyFile: DEFAULT_PATHS.commercializationPolicyFile,
  }));

  const outputFiles = await fs.readdir(outputDir);
  assert.equal(outputFiles.some((name) => name.endsWith(".failed.json")), true);
  assert.equal(outputFiles.includes("index.json"), false);
  const failureFile = outputFiles.find((name) => name.endsWith(".failed.json"));
  const failure = await readJson(path.join(outputDir, failureFile));
  assert.equal(failure.status, "FAILED");
  assert.equal(failure.plugin_results.length, 1);
  assert.equal(failure.failed_plugin.plugin_id, "foundry.cybercore.source-verification");
  assert.equal(failure.safety.external_actions_executed, 0);
});
