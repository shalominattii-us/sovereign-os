import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const FOUNDRY_ROOT = path.resolve(moduleDirectory, "..");
export const REPOSITORY_ROOT = path.resolve(FOUNDRY_ROOT, "../..");
export const CYBERCORE_ROOT = path.join(REPOSITORY_ROOT, "CYBERCORE", "opportunity_intake");

export const DEFAULT_PATHS = Object.freeze({
  baseDir: CYBERCORE_ROOT,
  inputFile: path.join(CYBERCORE_ROOT, "incoming", "AEGENTIX-CYBERCORE-OPP-INTAKE-2026-08-06.json"),
  evidenceFile: path.join(CYBERCORE_ROOT, "evidence", "source-verification-2026-08-06.json"),
  intelligencePolicyFile: path.join(CYBERCORE_ROOT, "policy", "intelligence-policy-v1.json"),
  commercializationPolicyFile: path.join(CYBERCORE_ROOT, "policy", "commercialization-policy-v1.json"),
  outputDir: path.join(FOUNDRY_ROOT, "outputs"),
  manifestFile: path.join(FOUNDRY_ROOT, "manifests", "cybercore-opportunity-intelligence.plugin.json"),
  canonicalSpecification: path.join(CYBERCORE_ROOT, "docs", "INTELLIGENCE_PIPELINE_SPEC_v2.md"),
  operatorGuide: path.join(CYBERCORE_ROOT, "README.md"),
  verificationEvidence: path.join(CYBERCORE_ROOT, "VERIFICATION.md"),
});
