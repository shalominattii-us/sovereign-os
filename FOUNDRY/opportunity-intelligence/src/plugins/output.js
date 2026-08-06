import path from "node:path";

import { loadRecords } from "../../../../CYBERCORE/opportunity_intake/src/storage.js";
import { defineFoundryPlugin } from "../plugin_contract.js";
import { emitOpportunityOutputs } from "../output_engine.js";

export const outputPlugin = defineFoundryPlugin({
  id: "foundry.cybercore.output",
  version: "1.0.0",
  stage: "OUTPUT_ENGINE",
  hook: "foundry.opportunity.emit-output",
  description: "Emit immutable opportunity-maturity bundles and a zero-dispatch decision-support index.",
  async execute(context) {
    const records = await loadRecords(path.join(context.baseDir, "normalized"));
    if (records.length === 0) throw new Error("Foundry output engine found no normalized opportunity records");
    const result = await emitOpportunityOutputs(records, {
      outputDir: context.outputDir,
      generatedAt: context.generatedAt,
      pipelineRunId: context.pipelineRunId ?? null,
    });
    return {
      output_run_id: result.index.output_run_id,
      total_outputs: result.index.total_outputs,
      human_review_required: result.index.human_review_required,
      automatic_dispatches: result.index.automatic_dispatches,
      external_actions_executed: result.index.external_actions_executed,
      by_maturity: result.index.by_maturity,
      by_disposition: result.index.by_disposition,
      index_artifact_hash: result.index.artifact_hash,
      output_dir: context.outputDir,
    };
  },
});
