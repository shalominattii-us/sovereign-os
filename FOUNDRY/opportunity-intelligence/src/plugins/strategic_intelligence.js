import { scoreOpportunities } from "../../../../CYBERCORE/opportunity_intake/src/engine.js";
import { defineFoundryPlugin } from "../plugin_contract.js";

export const strategicIntelligencePlugin = defineFoundryPlugin({
  id: "foundry.cybercore.strategic-intelligence",
  version: "1.0.0",
  stage: "STRATEGIC_INTELLIGENCE",
  hook: "foundry.opportunity.score",
  description: "Score strictly verified opportunities with the declared five-dimension intelligence policy.",
  async execute(context) {
    const result = await scoreOpportunities({
      baseDir: context.baseDir,
      policyFile: context.intelligencePolicyFile,
      recordSelector: "all",
      kernelUrl: context.kernelUrl ?? null,
      kernelRequired: context.kernelRequired ?? false,
      actor: "system:foundry-strategic-intelligence",
    });
    return {
      run_id: result.manifest.run_id,
      summary: result.manifest.summary,
      record_ids: result.records.map((record) => record.id),
      policy_version: result.manifest.policy_version,
      policy_hash: result.manifest.policy_hash,
      kernel_publication: result.manifest.kernel_publication,
    };
  },
});
