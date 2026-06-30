import { loadEvents } from "./eventStore.js";
import { apply } from "../state/projector.js";
import { eventLog } from "../core/eventBus.js";
import { log } from "../core/logger.js";

/**
 * Replay Engine
 *
 * This is the constitutional core of WorldMonitor's event sourcing.
 * It reads every persisted event from disk and applies it through the
 * projector to rebuild world state deterministically.
 *
 * Rules enforced here:
 *   - Events are applied in the exact order they were written (chronological)
 *   - Malformed lines are skipped and counted, never silently swallowed
 *   - The replay manifest is returned so callers can report or assert on it
 *   - No event is ever modified during replay
 *
 * @returns {ReplayManifest}
 */
export function replay() {
  const startedAt = Date.now();

  const { events, skipped } = loadEvents();

  let applied = 0;

  for (const event of events) {
    eventLog.push(event);   // restore in-memory session log
    apply(event);            // project onto world state
    applied++;
  }

  const durationMs = Date.now() - startedAt;

  const manifest = {
    applied,
    skipped,
    durationMs,
    replayedAt: new Date().toISOString(),
    status: skipped === 0 ? "clean" : "degraded",
  };

  if (applied === 0 && skipped === 0) {
    log("info", "Replay: no persisted events found. Starting with empty world state.");
  } else {
    log("info", `Replay complete.`, manifest);
    if (skipped > 0) {
      log("warn", `Replay: ${skipped} malformed line(s) were skipped. Inspect data/events.jsonl.`);
    }
  }

  return manifest;
}

/**
 * @typedef {Object} ReplayManifest
 * @property {number}  applied     - Number of events successfully applied
 * @property {number}  skipped     - Number of malformed lines skipped
 * @property {number}  durationMs  - Wall-clock time for the full replay
 * @property {string}  replayedAt  - ISO timestamp of when replay completed
 * @property {"clean"|"degraded"} status - "clean" if no lines were skipped
 */
