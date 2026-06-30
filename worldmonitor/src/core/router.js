import { log } from "./logger.js";

/**
 * Route an event to the appropriate domain handler.
 * Each domain adapter will eventually register its own handler here.
 *
 * @param {Object} event - Validated, enriched event
 * @returns {Promise<boolean>}
 */
export async function route(event) {
  log("info", `ROUTING EVENT: ${event.type}`, { domain: event.domain, entity_id: event.entity_id });

  switch (event.domain) {
    case "robotics":
      log("info", "ROBOT COMMAND DISPATCHED", event.payload);
      // TODO: delegate to adapters/ros2/index.js when ROS2 bridge is ready
      break;

    case "treasury":
      log("info", "TREASURY EVENT DISPATCHED", event.payload);
      // TODO: delegate to adapters/treasury/index.js
      break;

    case "xr":
      log("info", "XR EVENT DISPATCHED", event.payload);
      // TODO: delegate to adapters/xr/index.js
      break;

    default:
      log("warn", `No handler registered for domain: ${event.domain}`);
  }

  return true;
}
