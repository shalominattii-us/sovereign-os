import { v4 as uuid } from "uuid";
import { appendEvent } from "../events/eventStore.js";

/**
 * In-memory event log for the current session.
 * Populated from disk on startup via replay, then appended to on each new emit.
 */
export const eventLog = [];

/**
 * Emit a new event: enrich it with a UUID and timestamp,
 * push it to the in-memory log, and persist it to disk.
 *
 * @param {Object} raw  - { domain, type, entity_id, payload }
 * @returns {Object}    - Enriched event object
 */
export function emit(raw) {
  const event = {
    event_id: uuid(),
    timestamp: Date.now(),
    ...raw,
  };

  eventLog.push(event);
  appendEvent(event);   // persist immediately — append-only
  return event;
}
