import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { artifactHash } from "../../../CYBERCORE/opportunity_intake/src/canonical.js";
import { reviewReadyRecord } from "../../../CYBERCORE/opportunity_intake/tests/fixtures.js";
import {
  createOpportunityOutputBundle,
  emitOpportunityOutputs,
} from "../src/output_engine.js";

const TIMESTAMP = "2026-08-06T18:00:00.000Z";

test("ready records produce integrity-bound HUMAN_REVIEW decision support", async () => {
  const record = reviewReadyRecord({}, {
    retrieved_at: TIMESTAMP,
    deadline: "2026-11-01",
  });
  const bundle = createOpportunityOutputBundle(record, {
    generatedAt: TIMESTAMP,
    pipelineRunId: "foundry_run_test",
  });

  assert.equal(bundle.maturity.stage, "HUMAN_REVIEW");
  assert.equal(bundle.decision.disposition, "REQUIRES_HUMAN_DECISION");
  assert.equal(bundle.decision.human_decision_required, true);
  assert.equal(bundle.treasury_labs.automatic_dispatch, false);
  assert.equal(bundle.treasury_labs.handoff_executed, false);
  assert.equal(bundle.safety.external_action_executed, false);
  assert.equal(bundle.source.record_hash, artifactHash(record));
  assert.equal(bundle.artifact_hash, artifactHash({ ...bundle, artifact_hash: null }));
});

test("closed records produce terminal no-action maturity outputs", async () => {
  const record = reviewReadyRecord(
    { record_status: "historical" },
    {
      retrieved_at: TIMESTAMP,
      classification: "HISTORICAL",
      official_status: "closed",
      deadline: "2026-07-01",
    },
  );
  const bundle = createOpportunityOutputBundle(record, { generatedAt: TIMESTAMP });

  assert.equal(bundle.maturity.stage, "CLOSED");
  assert.equal(bundle.maturity.terminal, true);
  assert.equal(bundle.decision.disposition, "NO_ACTION_HISTORICAL");
  assert.equal(bundle.decision.actionable, false);
});

test("output generation removes stale bundles and writes a zero-dispatch index", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "aegentix-foundry-output-"));
  await fs.writeFile(path.join(outputDir, "stale.maturity.json"), "{}\n", "utf8");
  const record = reviewReadyRecord({}, { retrieved_at: TIMESTAMP });

  const result = await emitOpportunityOutputs([record], {
    outputDir,
    generatedAt: TIMESTAMP,
    pipelineRunId: "foundry_run_test",
  });
  const files = (await fs.readdir(outputDir)).sort();

  assert.equal(files.includes("stale.maturity.json"), false);
  assert.deepEqual(files, ["index.json", `${record.id}.maturity.json`]);
  assert.equal(result.index.total_outputs, 1);
  assert.equal(result.index.human_review_required, 1);
  assert.equal(result.index.automatic_dispatches, 0);
  assert.equal(result.index.external_actions_executed, 0);
  assert.equal(result.index.artifact_hash, artifactHash({ ...result.index, artifact_hash: null }));
});
