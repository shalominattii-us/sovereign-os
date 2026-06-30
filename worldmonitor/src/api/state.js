import { Router } from "express";
import { getSnapshot } from "../state/selectors.js";
import { eventLog } from "../core/eventBus.js";

const router = Router();

/**
 * GET /state
 *
 * Returns the current in-memory world state snapshot.
 * This is the live projection of all events applied since startup (including replayed events).
 */
router.get("/", (req, res) => {
  res.json({
    ok: true,
    state: getSnapshot(),
    sessionEvents: eventLog.length,
  });
});

/**
 * GET /state/events
 *
 * Returns the in-memory event log for the current session.
 * For the full persisted log, read data/events.jsonl directly.
 */
router.get("/events", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const events = eventLog.slice(-limit);
  res.json({ ok: true, count: events.length, events });
});

export default router;
