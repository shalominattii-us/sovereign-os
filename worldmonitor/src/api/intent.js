import { Router } from "express";
import { emit } from "../core/eventBus.js";
import { validate } from "../core/policyEngine.js";
import { route } from "../core/router.js";
import { apply } from "../state/projector.js";

const router = Router();

/**
 * POST /intent
 *
 * Accept an intent payload, enrich it into an event, validate it against
 * policy, route it to the appropriate domain handler, and apply it to
 * world state. The event is persisted to disk before this handler returns.
 *
 * Body: { domain, type, entity_id, payload }
 */
router.post("/", async (req, res) => {
  try {
    const { domain = "robotics", type = "MOVE_COMMAND", entity_id = "robot-arm-01", ...rest } = req.body;

    const event = emit({ domain, type, entity_id, payload: rest.payload ?? req.body });

    const check = validate(event);
    if (!check.ok) {
      return res.status(400).json({ status: "rejected", reason: check.reason, event_id: event.event_id });
    }

    await route(event);
    apply(event);

    return res.json({ status: "executed", event });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
