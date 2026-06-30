import { state } from "./worldState.js";

/**
 * Selectors — read-only queries over world state.
 * Components and API handlers should use these instead of
 * accessing the state object directly.
 */

export const getRobots      = ()         => state.robots;
export const getRobot       = (id)       => state.robots[id] ?? null;
export const getTreasury    = ()         => state.treasury;
export const getXR          = ()         => state.xr;
export const getEventCount  = ()         => state.eventCount;

/** Return a full snapshot of the world state (for the /state endpoint). */
export function getSnapshot() {
  return {
    robots:     state.robots,
    treasury:   state.treasury,
    xr:         state.xr,
    eventCount: state.eventCount,
  };
}
