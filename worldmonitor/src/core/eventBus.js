import { v4 as uuid } from "uuid";
import { appendEvent } from "../events/eventStore.js";

/**
 * In-memory event log for the current session.
 * Populated from disk on startup via replay, then appended to on each new emit.
 */
export const eventLog = [];

/**
 * Emit a new event: enrich it with canonical metadata, persist it to disk,
 * and push it to the in-memory log.
 *
 * Every emitted event conforms to the AEGENTIS Event Specification v1
 * (see docs/EVENT_SPEC_v1.md). Fields are ordered: envelope metadata first,
 * then domain-specific fields, then payload.
 *
 * @param {Object} raw  - { domain, type, entity_id, payload,
 *                         source?, actor?, correlation_id?, trace_id? }
 * @returns {Object}    - Fully enriched event conforming to EVENT_SPEC_v1
 */
export function emit(raw) {
  const event = {
    // ─── Envelope (always present) ────────────────────────────────────────────
    event_id:       uuid(),
    event_version:  1,
    timestamp:      Date.now(),

    // ─── Tracing (optional, defaults to new trace if not provided) ─────────────
    trace_id:       raw.trace_id       ?? uuid(),
    correlation_id: raw.correlation_id ?? null,

    // ─── Origin (optional, defaults to worldmonitor) ───────────────────────
    source:         raw.source ?? "worldmonitor",
    actor:          raw.actor  ?? null,

    // ─── Domain fields ──────────────────────────────────────────────────
    domain:         raw.domain,
    type:           raw.type,
    entity_id:      raw.entity_id,
    payload:        raw.payload,
  };

  eventLog.push(event);
  appendEvent(event);   // persist immediately — append-only
  return event;
}
