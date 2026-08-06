import { randomUUID } from "node:crypto";
import path from "node:path";
import { CYBERCORE_DOMAIN, EVENT_VERSION } from "./constants.js";
import { appendJsonLine } from "./storage.js";
import { InputValidationError } from "./errors.js";

export function createOpportunityEvent({
  type,
  entityId,
  payload,
  source = "aegentix-cybercore-opportunity-intake",
  actor = "system:opportunity-intake",
  correlationId = null,
  traceId = null,
  timestamp = Date.now(),
}) {
  if (!type || !entityId || !payload || typeof payload !== "object") {
    throw new InputValidationError("Event requires type, entityId, and object payload");
  }
  return {
    event_id: randomUUID(),
    event_version: EVENT_VERSION,
    timestamp,
    trace_id: traceId ?? `tr-${randomUUID()}`,
    correlation_id: correlationId,
    source,
    actor,
    domain: CYBERCORE_DOMAIN,
    type,
    entity_id: entityId,
    payload,
  };
}

export async function persistOpportunityEvent(baseDir, event) {
  await appendJsonLine(path.join(baseDir, "events", "opportunity_events.jsonl"), event);
  return event;
}

function intentEndpoint(kernelUrl) {
  const url = new URL(kernelUrl);
  if (!url.pathname || url.pathname === "/") url.pathname = "/intent";
  return url.toString();
}

export async function publishOpportunityEvent(event, kernelUrl, { required = false, timeoutMs = 5000 } = {}) {
  if (!kernelUrl) return { attempted: false, published: false, response: null, error: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(intentEndpoint(kernelUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        domain: event.domain,
        type: event.type,
        entity_id: event.entity_id,
        payload: event.payload,
        trace_id: event.trace_id,
        correlation_id: event.correlation_id,
        source: event.source,
        actor: event.actor,
      }),
    });
    const body = await response.json().catch(() => ({ error: "Kernel returned non-JSON response" }));
    if (!response.ok) {
      const error = `Kernel rejected event with HTTP ${response.status}: ${body.error ?? "unknown error"}`;
      if (required) throw new Error(error);
      return { attempted: true, published: false, response: body, error };
    }
    return { attempted: true, published: true, response: body, error: null };
  } catch (error) {
    if (required) throw error;
    return { attempted: true, published: false, response: null, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}
