import { verifyOpportunitySources } from "../../../../CYBERCORE/opportunity_intake/src/engine.js";
import { defineFoundryPlugin } from "../plugin_contract.js";

export const sourceVerificationPlugin = defineFoundryPlugin({
  id: "foundry.cybercore.source-verification",
  version: "1.0.0",
  stage: "SOURCE_VERIFICATION",
  hook: "foundry.opportunity.verify-source",
  description: "Bind authoritative evidence to canonical records and assign deterministic temporal status.",
  async execute(context) {
    const result = await verifyOpportunitySources({
      baseDir: context.baseDir,
      evidenceFile: context.evidenceFile,
      kernelUrl: context.kernelUrl ?? null,
      kernelRequired: context.kernelRequired ?? false,
      actor: "system:foundry-source-verification",
    });
    return {
      run_id: result.manifest.run_id,
      summary: result.manifest.summary,
      record_ids: result.records.map((record) => record.id),
      kernel_publication: result.manifest.kernel_publication,
    };
  },
});
