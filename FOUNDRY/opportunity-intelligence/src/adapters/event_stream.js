const DEFAULT_TOPIC = "foundry.opportunity-intelligence.output";

function validatedStreamUrl(value) {
  const url = new URL(value);
  const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new TypeError("Foundry stream URL must use HTTPS unless it targets localhost");
  }
  return url;
}

export async function publishOutputIndex(index, {
  streamUrl,
  topic = DEFAULT_TOPIC,
  required = false,
} = {}) {
  if (!streamUrl) {
    return { configured: false, attempted: false, published: false, required, topic, error: null };
  }
  const url = validatedStreamUrl(streamUrl);
  const endpoint = new URL("/publish", url);
  const event = {
    schema_version: index.schema_version,
    output_run_id: index.output_run_id,
    generated_at: index.generated_at,
    total_outputs: index.total_outputs,
    human_review_required: index.human_review_required,
    automatic_dispatches: 0,
    external_actions_executed: 0,
    by_maturity: index.by_maturity,
    by_disposition: index.by_disposition,
    artifact_hash: index.artifact_hash,
  };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, event }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true) {
      throw new Error(`Foundry output stream rejected publication with HTTP ${response.status}`);
    }
    return { configured: true, attempted: true, published: true, required, topic, error: null };
  } catch (error) {
    if (required) throw error;
    return { configured: true, attempted: true, published: false, required, topic, error: error.message };
  }
}
