import { loadEvents } from "./eventStore.js";
import { apply } from "../state/projector.js";
import { eventLog } from "../core/eventBus.js";
import { log } from "../core/logger.js";

/**
 * Replay Engine
 *
 * This is the constitutional core of WorldMonitor's event sourcing.
 *
 * ─── ARCHITECTURAL INVARIANT ─────────────────────────────────────────────────
 * During replay, ONLY the Projector is called.
 * The Router is NEVER invoked during replay.
 *
 * Reason: the Router performs external side effects — sending commands to
 * robots, submitting exchange orders, triggering XR scenes. Those actions
 * already happened when the events were first processed. Re-running them
 * during replay would cause duplicate commands, double-spends, and
 * undefined physical behavior.
 *
 * The two distinct execution paths are:
 *
 *   Live intent:
 *     PolicyEngine.validate()
 *       → EventStore.append()
 *       → Projector.apply()        ← updates in-memory state
 *       → Router.dispatch()        ← performs external side effects
 *
 *   Replay (startup):
 *     EventStore.replay()
 *       → Projector.apply()        ← rebuilds in-memory state only
 *                                  ← Router is intentionally absent
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Additional rules enforced here:
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
    apply(event);            // project onto world state — NO router call
    applied++;
  }

  const durationMs = Date.now() - startedAt;

  const manifest = {
    applied,
    skipped,
    routerDispatched: 0,   // always 0 — structural proof that replay never routes
    durationMs,
    replayedAt: new Date().toISOString(),
    status: skipped === 0 ? "clean" : "degraded",
  };

  if (applied === 0 && skipped === 0) {
    log("info", "Replay: no persisted events found. Starting with empty world state.");
  } else {
    log("info", "Replay complete.", manifest);
    if (skipped > 0) {
      log("warn", `Replay: ${skipped} malformed line(s) were skipped. Inspect data/events.jsonl.`);
    }
  }

  return manifest;
}

/**
 * @typedef {Object} ReplayManifest
 * @property {number}  applied           - Number of events successfully applied to state
 * @property {number}  skipped           - Number of malformed lines skipped
 * @property {number}  routerDispatched  - Always 0; structural proof of router isolation
 * @property {number}  durationMs        - Wall-clock time for the full replay
 * @property {string}  replayedAt        - ISO timestamp of when replay completed
 * @property {"clean"|"degraded"} status - "clean" if no lines were skipped
 */
