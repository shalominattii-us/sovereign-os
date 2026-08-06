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

  if (event.domain === "cybercore") {
    const authorizationMode = event.payload?.authorization_mode
      ?? event.payload?.record?.authorization?.mode
      ?? event.payload?.authorization?.mode;
    if (authorizationMode !== "human_required") {
      return { ok: false, reason: "cybercore opportunities require human_required authorization mode" };
    }

    if (["OPPORTUNITY_DISCOVERED", "OPPORTUNITY_MERGED"].includes(event.type)) {
      const record = event.payload?.record;
      if (!record?.id || !record?.deduplication_key || !record?.action_state) {
        return { ok: false, reason: "cybercore discovery and merge events require a normalized record" };
      }
      if (record.action_state === "AUTHORIZED_ACTION") {
        return { ok: false, reason: "authorized state may only be entered through an authorization event" };
      }
    }

    if (event.type === "OPPORTUNITY_AUTHORIZATION_RECORDED") {
      const authorization = event.payload?.authorization;
      if (!authorization?.authorization_id || !authorization?.artifact_hash) {
        return { ok: false, reason: "authorization event requires a complete authorization artifact" };
      }
      if (!authorization.authorized_by?.startsWith("human:")) {
        return { ok: false, reason: "authorization event requires an explicit human actor" };
      }
      if (event.payload?.action_state !== "AUTHORIZED_ACTION") {
        return { ok: false, reason: "authorization event must project AUTHORIZED_ACTION state" };
      }
    }
  }

  // Future domains: treasury, xr, exchange — add rules here
  return { ok: true };
}
