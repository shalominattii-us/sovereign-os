import { artifactHash, isoTimestamp } from "../../../CYBERCORE/opportunity_intake/src/canonical.js";

const PLUGIN_ID_PATTERN = /^foundry\.[a-z0-9-]+\.[a-z0-9-]+$/;
const HOOK_PATTERN = /^foundry\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export function defineFoundryPlugin({
  id,
  version,
  stage,
  hook,
  description,
  execute,
}) {
  if (!PLUGIN_ID_PATTERN.test(id ?? "")) throw new TypeError(`Invalid Foundry plugin id: ${id}`);
  if (!HOOK_PATTERN.test(hook ?? "")) throw new TypeError(`Invalid Foundry hook: ${hook}`);
  if (!version || !stage || !description || typeof execute !== "function") {
    throw new TypeError(`Incomplete Foundry plugin contract: ${id}`);
  }
  return Object.freeze({ id, version, stage, hook, description, execute });
}

export async function executeFoundryPlugin(plugin, context) {
  if (!plugin || typeof plugin.execute !== "function") throw new TypeError("Executable Foundry plugin is required");
  const startedAt = isoTimestamp();
  try {
    const output = await plugin.execute(context);
    const result = {
      plugin_id: plugin.id,
      plugin_version: plugin.version,
      stage: plugin.stage,
      hook: plugin.hook,
      status: "COMPLETED",
      started_at: startedAt,
      completed_at: isoTimestamp(),
      output,
      artifact_hash: null,
    };
    result.artifact_hash = artifactHash({ ...result, artifact_hash: null });
    return result;
  } catch (error) {
    const failure = {
      plugin_id: plugin.id,
      plugin_version: plugin.version,
      stage: plugin.stage,
      hook: plugin.hook,
      status: "FAILED",
      started_at: startedAt,
      failed_at: isoTimestamp(),
      error: {
        name: error.name,
        code: error.code ?? "UNEXPECTED_ERROR",
        message: error.message,
        details: error.details ?? null,
      },
      artifact_hash: null,
    };
    failure.artifact_hash = artifactHash({ ...failure, artifact_hash: null });
    error.foundryPluginResult = failure;
    throw error;
  }
}
