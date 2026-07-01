/**
 * WorldState
 *
 * The canonical in-memory representation of the world.
 * Rebuilt deterministically at startup by replaying the event log.
 * Never mutated directly — always updated via the projector.
 */
export const state = {
  robots:    {},   // entity_id → { lastCommand, position, updated }
  treasury:  {},   // account_id → { balance, lastTx, updated }
  xr:        {},   // scene_id → { loaded, avatars, updated }
  eventCount: 0,   // total events applied since last replay
};
