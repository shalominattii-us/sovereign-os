import fs from "node:fs/promises";
import path from "node:path";

import { artifactHash, isoTimestamp } from "../../../CYBERCORE/opportunity_intake/src/canonical.js";
import { publishOutputIndex } from "./adapters/event_stream.js";
import { executeFoundryPlugin } from "./plugin_contract.js";
import { DEFAULT_PATHS, REPOSITORY_ROOT } from "./paths.js";
import { commercializationPlugin } from "./plugins/commercialization.js";
import { discoveryPlugin } from "./plugins/discovery.js";
import { outputPlugin } from "./plugins/output.js";
import { sourceVerificationPlugin } from "./plugins/source_verification.js";
import { strategicIntelligencePlugin } from "./plugins/strategic_intelligence.js";

export const FOUNDRY_PLUGINS = Object.freeze([
  discoveryPlugin,
  sourceVerificationPlugin,
  strategicIntelligencePlugin,
  commercializationPlugin,
  outputPlugin,
]);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}

export async function validateFoundryManifest(manifest, {
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  if (manifest?.schema_version !== "aegentix.foundry.plugin-manifest.v1") {
    throw new TypeError("Unsupported or missing Foundry plugin-manifest schema version");
  }
  if (manifest.output_engine?.automatic_dispatch !== false
      || manifest.output_engine?.external_action_execution !== false
      || manifest.safety?.treasury_labs_automatic_handoff !== false
      || manifest.safety?.authorization_policy !== "human_required") {
    throw new TypeError("Foundry manifest violates the human-required, zero-automatic-dispatch boundary");
  }

  const runtimeIds = FOUNDRY_PLUGINS.map((plugin) => plugin.id);
  const manifestIds = (manifest.plugins ?? []).map((plugin) => plugin.id);
  if (JSON.stringify(runtimeIds) !== JSON.stringify(manifestIds)) {
    throw new TypeError("Foundry manifest plugin order does not match the executable plugin chain");
  }

  const referencedPaths = [
    manifest.runtime?.entrypoint,
    manifest.runtime?.package,
    ...(manifest.plugins ?? []).map((plugin) => plugin.implementation),
    ...Object.values(manifest.inputs ?? {}),
    ...Object.values(manifest.schemas ?? {}),
    manifest.output_engine?.implementation,
    manifest.output_engine?.bundle_schema,
    manifest.output_engine?.index_schema,
    ...(manifest.canonical_documents ?? []),
  ].filter(Boolean);
  for (const relativePath of referencedPaths) {
    await fs.access(path.resolve(repositoryRoot, relativePath));
  }
  return true;
}

export async function loadFoundryManifest(manifestFile = DEFAULT_PATHS.manifestFile) {
  const manifest = await readJson(manifestFile);
  await validateFoundryManifest(manifest);
  return manifest;
}

export async function runFoundryOpportunityPipeline({
  baseDir = DEFAULT_PATHS.baseDir,
  inputFile = DEFAULT_PATHS.inputFile,
  evidenceFile = DEFAULT_PATHS.evidenceFile,
  intelligencePolicyFile = DEFAULT_PATHS.intelligencePolicyFile,
  commercializationPolicyFile = DEFAULT_PATHS.commercializationPolicyFile,
  outputDir = DEFAULT_PATHS.outputDir,
  manifestFile = DEFAULT_PATHS.manifestFile,
  source = "foundry-opportunity-intelligence",
  batchSelector = null,
  kernelUrl = null,
  kernelRequired = false,
  streamUrl = null,
  streamRequired = false,
} = {}) {
  const manifest = await loadFoundryManifest(manifestFile);
  const startedAt = isoTimestamp();
  const pipelineRunId = `foundry_run_${artifactHash({
    foundry_id: manifest.foundry_id,
    started_at: startedAt,
    base_dir: path.resolve(baseDir),
    input_file: path.resolve(inputFile),
  }).slice(0, 24)}`;
  const context = {
    baseDir: path.resolve(baseDir),
    inputFile: path.resolve(inputFile),
    evidenceFile: path.resolve(evidenceFile),
    intelligencePolicyFile: path.resolve(intelligencePolicyFile),
    commercializationPolicyFile: path.resolve(commercializationPolicyFile),
    outputDir: path.resolve(outputDir),
    source,
    batchSelector,
    kernelUrl,
    kernelRequired,
    generatedAt: startedAt,
    pipelineRunId,
  };

  const pluginResults = [];
  try {
    for (const plugin of FOUNDRY_PLUGINS) {
      pluginResults.push(await executeFoundryPlugin(plugin, context));
    }
    const outputIndex = await readJson(path.join(context.outputDir, "index.json"));
    const streamPublication = await publishOutputIndex(outputIndex, {
      streamUrl,
      required: streamRequired,
    });
    const runManifest = {
      schema_version: "aegentix.foundry.run-manifest.v1",
      foundry_run_id: pipelineRunId,
      foundry_id: manifest.foundry_id,
      foundry_version: manifest.version,
      status: "COMPLETED",
      started_at: startedAt,
      completed_at: isoTimestamp(),
      plugin_results: pluginResults,
      output: {
        output_run_id: outputIndex.output_run_id,
        total_outputs: outputIndex.total_outputs,
        human_review_required: outputIndex.human_review_required,
        index_artifact_hash: outputIndex.artifact_hash,
      },
      stream_publication: streamPublication,
      safety: {
        automatic_dispatches: outputIndex.automatic_dispatches,
        external_actions_executed: outputIndex.external_actions_executed,
        treasury_labs_handoffs_executed: 0,
        authorization_policy: "human_required",
      },
      artifact_hash: null,
    };
    runManifest.artifact_hash = artifactHash({ ...runManifest, artifact_hash: null });
    await writeJsonAtomic(path.join(context.outputDir, `${pipelineRunId}.manifest.json`), runManifest);
    await writeJsonAtomic(path.join(context.outputDir, "latest-run.json"), runManifest);
    return runManifest;
  } catch (error) {
    const failedManifest = {
      schema_version: "aegentix.foundry.run-manifest.v1",
      foundry_run_id: pipelineRunId,
      foundry_id: manifest.foundry_id,
      foundry_version: manifest.version,
      status: "FAILED",
      started_at: startedAt,
      failed_at: isoTimestamp(),
      plugin_results: pluginResults,
      failed_plugin: error.foundryPluginResult ?? null,
      error: {
        name: error.name,
        code: error.code ?? "UNEXPECTED_ERROR",
        message: error.message,
        details: error.details ?? null,
      },
      safety: {
        automatic_dispatches: 0,
        external_actions_executed: 0,
        treasury_labs_handoffs_executed: 0,
        authorization_policy: "human_required",
      },
      artifact_hash: null,
    };
    failedManifest.artifact_hash = artifactHash({ ...failedManifest, artifact_hash: null });
    await writeJsonAtomic(path.join(context.outputDir, `${pipelineRunId}.failed.json`), failedManifest).catch(() => {});
    throw error;
  }
}
