/**
 * Policy Engine
 *
 * Validates events before they are routed and applied to world state.
 * Rules are domain-scoped and can be extended per adapter.
 *
 * @param {Object} event - Enriched event from eventBus
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validate(event) {
  if (event.domain === "robotics") {
    if (!event.payload?.approved) {
      return { ok: false, reason: "robot command not approved by policy" };
    }
    if (event.payload.force !== undefined && event.payload.force > 5) {
      return { ok: false, reason: "force value exceeds safe threshold (max 5)" };
    }
  }

  // Future domains: treasury, xr, exchange — add rules here
  return { ok: true };
}
