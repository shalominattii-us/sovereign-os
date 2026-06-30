import { Router } from "express";
import { getStorePath, getEventCount } from "../events/eventStore.js";

const router = Router();

/**
 * Replay manifest — set once at startup by index.js.
 * Exposed via GET /health so operators and monitoring systems can
 * verify that the event log was loaded cleanly on every restart.
 *
 * @type {import("../events/replay.js").ReplayManifest | null}
 */
let replayManifest = null;

/**
 * Called once at startup (from index.js) after replay completes.
 * @param {import("../events/replay.js").ReplayManifest} manifest
 */
export function setReplayManifest(manifest) {
  replayManifest = manifest;
}

/**
 * GET /health
 *
 * Liveness probe. Returns service metadata, event store stats,
 * and the replay manifest from the most recent startup.
 *
 * A "degraded" replay status means one or more lines in events.jsonl
 * were malformed and skipped — this warrants investigation.
 */
router.get("/", (req, res) => {
  res.json({
    ok:           true,
    service:      "WorldMonitor",
    version:      "0.3.0",
    uptime:       process.uptime(),
    storePath:    getStorePath(),
    storedEvents: getEventCount(),
    replay:       replayManifest,
    ts:           new Date().toISOString(),
  });
});

export default router;
