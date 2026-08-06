import { ingestBatch } from "../../../../CYBERCORE/opportunity_intake/src/engine.js";
import { defineFoundryPlugin } from "../plugin_contract.js";

export const discoveryPlugin = defineFoundryPlugin({
  id: "foundry.cybercore.discovery",
  version: "1.0.0",
  stage: "DISCOVERY",
  hook: "foundry.opportunity.discover",
  description: "Normalize, deduplicate, persist, and event-source an approved opportunity intake batch.",
  async execute(context) {
    const result = await ingestBatch({
      baseDir: context.baseDir,
      inputFile: context.inputFile,
      source: context.source ?? "foundry-opportunity-intelligence",
      batchSelector: context.batchSelector ?? null,
      mode: "normalize_validate",
      authorization: "human_required",
      kernelUrl: context.kernelUrl ?? null,
      kernelRequired: context.kernelRequired ?? false,
    });
    return {
      run_id: result.manifest.run_id,
      summary: result.manifest.summary,
      record_ids: result.records.map((record) => record.id),
      kernel_publication: result.manifest.kernel_publication,
    };
  },
});
