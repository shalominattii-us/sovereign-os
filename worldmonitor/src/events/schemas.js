/**
 * Canonical event type registry for WorldMonitor.
 *
 * Each domain owns its event types. This file is the single source of truth
 * for all valid event type strings used across the system.
 */
export const EventTypes = {
  // Robotics domain
  MOVE_COMMAND:   "MOVE_COMMAND",
  STOP_COMMAND:   "STOP_COMMAND",
  STATUS_UPDATE:  "STATUS_UPDATE",

  // Treasury domain (placeholder)
  TRANSFER_INTENT:  "TRANSFER_INTENT",
  BALANCE_SNAPSHOT: "BALANCE_SNAPSHOT",

  // XR domain (placeholder)
  SCENE_LOAD:     "SCENE_LOAD",
  AVATAR_SPAWN:   "AVATAR_SPAWN",
};

/**
 * Domains supported by WorldMonitor.
 */
export const Domains = {
  ROBOTICS: "robotics",
  TREASURY: "treasury",
  XR:       "xr",
  EXCHANGE: "exchange",
};
