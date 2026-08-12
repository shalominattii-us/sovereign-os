import { routeOpportunities } from "../../../../CYBERCORE/opportunity_intake/src/engine.js";
import { defineFoundryPlugin } from "../plugin_contract.js";

export const commercializationPlugin = defineFoundryPlugin({
  id: "foundry.cybercore.commercialization",
  version: "1.0.0",
  stage: "COMMERCIALIZATION_ROUTING",
  hook: "foundry.opportunity.route",
  description: "Map records to commercial candidate paths while stopping every ready record at explicit human review.",
  async execute(context) {
    const result = await routeOpportunities({
      baseDir: context.baseDir,
      policyFile: context.commercializationPolicyFile,
      recordSelector: "all",
      kernelUrl: context.kernelUrl ?? null,
      kernelRequired: context.kernelRequired ?? false,
      actor: "system:foundry-commercialization-routing",
      evaluatedAt: context.evaluatedAt ?? null,
    });
    if (result.manifest.summary.treasury_handoffs_executed !== 0) {
      throw new Error("Foundry safety invariant violated: Treasury Labs handoff executed automatically");
    }
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
