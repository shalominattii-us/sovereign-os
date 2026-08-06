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

    const recordSnapshotEvents = [
      "OPPORTUNITY_DISCOVERED",
      "OPPORTUNITY_MERGED",
      "OPPORTUNITY_SOURCE_VERIFIED",
      "OPPORTUNITY_INTELLIGENCE_SCORED",
      "OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED",
    ];
    if (recordSnapshotEvents.includes(event.type)) {
      const record = event.payload?.record;
      if (!record?.id || !record?.deduplication_key || !record?.action_state) {
        return { ok: false, reason: "cybercore record events require a normalized record snapshot" };
      }
      if (record.action_state === "AUTHORIZED_ACTION") {
        return { ok: false, reason: "authorized state may only be entered through an authorization event" };
      }
      if (event.type === "OPPORTUNITY_SOURCE_VERIFIED"
          && (!Array.isArray(record.source_evidence)
            || record.source_evidence.length === 0
            || !record.validation?.status)) {
        return { ok: false, reason: "source verification events require evidence and a validation decision" };
      }
      if (event.type === "OPPORTUNITY_INTELLIGENCE_SCORED"
          && (record.validation?.status !== "VERIFIED" || record.intelligence?.status !== "SCORED")) {
        return { ok: false, reason: "intelligence events require a verified, scored record" };
      }
      if (event.type === "OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED") {
        if (!record.commercialization?.status || event.payload?.treasury_handoff_executed !== false) {
          return { ok: false, reason: "commercial route events require a route and no automatic Treasury handoff" };
        }
        if (record.commercialization.status === "READY_FOR_HUMAN_REVIEW"
            && (record.action_state !== "HUMAN_REVIEW_REQUIRED"
              || record.commercialization.treasury_labs_handoff?.status !== "HUMAN_APPROVAL_REQUIRED")) {
          return { ok: false, reason: "ready commercial routes must stop at explicit human review" };
        }
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
