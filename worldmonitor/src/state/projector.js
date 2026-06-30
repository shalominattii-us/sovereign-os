import { state } from "./worldState.js";

/**
 * Projector
 *
 * Applies a single event to the world state.
 * This is the only place world state is mutated.
 * Because all mutations flow through here, state can always be
 * rebuilt by replaying the full event log from disk.
 *
 * @param {Object} event - Enriched, validated event
 */
export function apply(event) {
  state.eventCount += 1;

  switch (event.domain) {
    case "robotics":
      applyRobotics(event);
      break;

    case "treasury":
      applyTreasury(event);
      break;

    case "xr":
      applyXR(event);
      break;

    default:
      // Unknown domain — record it but don't mutate known state slices
      break;
  }
}

function applyRobotics(event) {
  const current = state.robots[event.entity_id] || {};
  state.robots[event.entity_id] = {
    ...current,
    lastCommand: event.payload,
    position:    event.payload.position ?? current.position ?? null,
    updated:     event.timestamp,
  };
}

function applyTreasury(event) {
  const current = state.treasury[event.entity_id] || {};
  state.treasury[event.entity_id] = {
    ...current,
    lastTx:  event.payload,
    updated: event.timestamp,
  };
}

function applyXR(event) {
  const current = state.xr[event.entity_id] || {};
  state.xr[event.entity_id] = {
    ...current,
    lastEvent: event.payload,
    updated:   event.timestamp,
  };
}
