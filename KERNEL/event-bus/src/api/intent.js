import { Router } from "express";
import { emit } from "../core/eventBus.js";
import { validate } from "../core/policyEngine.js";
import { route } from "../core/router.js";
import { apply } from "../state/projector.js";

const router = Router();

/**
 * POST /intent
 *
 * Live event lifecycle (the ONLY path that calls the Router):
 *
 *   1. PolicyEngine.validate()   — reject unsafe or unauthorized intents
 *   2. EventStore.append()       — persist the event (via emit) before any side effects
 *   3. Projector.apply()         — update in-memory world state
 *   4. Router.dispatch()         — perform external side effects (robots, exchanges, XR)
 *
 * This order is intentional:
 *   - Persistence happens before routing so a crash mid-dispatch leaves a recoverable record.
 *   - State is projected before routing so adapters can read current world state if needed.
 *   - The Router is ONLY called here, never during replay.
 *
 * Body: { domain, type, entity_id, payload, source?, actor?, correlation_id? }
 */
router.post("/", async (req, res) => {
  try {
    const {
      domain = "robotics",
      type   = "MOVE_COMMAND",
      entity_id = "robot-arm-01",
      source,
      actor,
      correlation_id,
      payload,
      ...rest
    } = req.body;

    // Step 1 — Validate intent before creating any event
    const preCheck = validate({ domain, payload: payload ?? rest });
    if (!preCheck.ok) {
      return res.status(400).json({ status: "rejected", reason: preCheck.reason });
    }

    // Step 2 — Emit: enrich with metadata and append to event store
    const event = emit({
      domain,
      type,
      entity_id,
      payload: payload ?? rest,
      ...(source         && { source }),
      ...(actor          && { actor }),
      ...(correlation_id && { correlation_id }),
    });

    // Step 3 — Project onto world state
    apply(event);

    // Step 4 — Dispatch to external adapters (side effects)
    await route(event);

    return res.json({ status: "executed", event });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
