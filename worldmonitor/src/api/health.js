import { Router } from "express";
import { getStorePath } from "../events/eventStore.js";
import { getEventCount } from "../state/selectors.js";

const router = Router();

/**
 * GET /health
 *
 * Liveness probe. Returns service metadata and event store path.
 * Useful for load balancers, Docker HEALTHCHECK, and monitoring dashboards.
 */
router.get("/", (req, res) => {
  res.json({
    ok:         true,
    service:    "WorldMonitor",
    version:    "0.2.0",
    uptime:     process.uptime(),
    eventCount: getEventCount(),
    storePath:  getStorePath(),
    ts:         new Date().toISOString(),
  });
});

export default router;
