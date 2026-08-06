import {
  ACTION_STATES,
  COMMERCIAL_PATHS,
  COMMERCIAL_ROUTE_STATUSES,
  COMMERCIALIZATION_POLICY_VERSION,
  TREASURY_HANDOFF_STATUSES,
  VALIDATION_STATUS,
} from "./constants.js";
import { isoTimestamp, uniqueStrings } from "./canonical.js";
import { InputValidationError } from "./errors.js";

function validatePolicy(policy) {
  if (!policy || policy.version !== COMMERCIALIZATION_POLICY_VERSION) {
    throw new InputValidationError("Commercialization policy version is unsupported", {
      expected: COMMERCIALIZATION_POLICY_VERSION,
      received: policy?.version ?? null,
    });
  }
  if (!Array.isArray(policy.path_precedence)
      || policy.path_precedence.some((path) => !COMMERCIAL_PATHS.includes(path))) {
    throw new InputValidationError("Commercialization path precedence is invalid");
  }
  return true;
}

function candidatePaths(record, policy) {
  const candidates = [...(policy.type_paths[record.type] ?? [])];
  candidates.push(...(policy.procurement_type_paths[record.procurement_type] ?? []));
  candidates.push(...(policy.market_entry_paths[record.market_entry] ?? []));

  const searchable = [
    record.program_type,
    record.revenue_path,
    record.title,
    record.sector,
  ].filter(Boolean).join(" ").toLowerCase();
  for (const rule of policy.program_keyword_paths) {
    if (rule.keywords.some((keyword) => searchable.includes(keyword.toLowerCase()))) {
      candidates.push(...rule.paths);
    }
  }
  const unique = uniqueStrings(candidates).filter((path) => COMMERCIAL_PATHS.includes(path));
  return policy.path_precedence.filter((path) => unique.includes(path));
}

function routeStatus(record, paths, policy) {
  if (record.temporal_status === "PROGRAM_ONLY") return COMMERCIAL_ROUTE_STATUSES.PROGRAM_DISCOVERY_ONLY;
  if (record.temporal_status === "FORECAST") return COMMERCIAL_ROUTE_STATUSES.MONITOR_FORECAST;
  if (record.temporal_status === "CLOSED") return COMMERCIAL_ROUTE_STATUSES.CLOSED_NO_ACTION;
  if (record.validation?.status !== VALIDATION_STATUS.VERIFIED || record.temporal_status === "UNKNOWN") {
    return COMMERCIAL_ROUTE_STATUSES.SOURCE_VERIFICATION_REQUIRED;
  }
  if (record.intelligence?.status !== "SCORED") {
    throw new InputValidationError("Commercialization routing requires a completed intelligence score", {
      record_id: record.id,
    });
  }
  if (paths.length === 0) return COMMERCIAL_ROUTE_STATUSES.NO_ROUTE_IDENTIFIED;
  if (policy.ready_temporal_statuses.includes(record.temporal_status)) {
    return COMMERCIAL_ROUTE_STATUSES.READY_FOR_HUMAN_REVIEW;
  }
  return COMMERCIAL_ROUTE_STATUSES.NO_ROUTE_IDENTIFIED;
}

function statusRationale(record, status, paths) {
  const rationale = [`Temporal status evaluated as ${record.temporal_status}.`];
  if (paths.length > 0) rationale.push(`Candidate paths identified: ${paths.join(", ")}.`);
  if (status === COMMERCIAL_ROUTE_STATUSES.READY_FOR_HUMAN_REVIEW) {
    rationale.push("The record is verified, scored, temporally actionable, and must receive explicit human review.");
  } else if (status === COMMERCIAL_ROUTE_STATUSES.CLOSED_NO_ACTION) {
    rationale.push("The observed deadline passed; new submission or bid activity is blocked.");
  } else if (status === COMMERCIAL_ROUTE_STATUSES.MONITOR_FORECAST) {
    rationale.push("The source is a forecast; monitor for a released solicitation before action.");
  } else if (status === COMMERCIAL_ROUTE_STATUSES.PROGRAM_DISCOVERY_ONLY) {
    rationale.push("The source verifies a program category, not one specific actionable opportunity.");
  } else if (status === COMMERCIAL_ROUTE_STATUSES.SOURCE_VERIFICATION_REQUIRED) {
    rationale.push("Strict source verification or temporal actionability is incomplete.");
  } else if (status === COMMERCIAL_ROUTE_STATUSES.NO_ROUTE_IDENTIFIED) {
    rationale.push("No defensible commercialization path met the routing policy.");
  }
  return rationale;
}

function treasuryHandoff(status, policy) {
  const ready = status === COMMERCIAL_ROUTE_STATUSES.READY_FOR_HUMAN_REVIEW;
  return {
    status: ready ? policy.treasury_labs.ready_status : policy.treasury_labs.blocked_status,
    reason: ready
      ? "Human approval is required before any Treasury Labs handoff or external action."
      : "Treasury Labs handoff is blocked until the opportunity is verified, actionable, scored, and human-approved.",
    automatic_dispatch: false,
  };
}

function resetAuthorization(authorization) {
  return {
    ...authorization,
    status: "PENDING",
    approved_action: null,
    authorization_id: null,
    authorized_by: null,
    authorized_at: null,
    expires_at: null,
    review_snapshot_hash: null,
    artifact_hash: null,
  };
}

export function routeOpportunity(record, policy, {
  timestamp = isoTimestamp(),
  actor = "system:commercialization-routing",
} = {}) {
  validatePolicy(policy);
  const paths = candidatePaths(record, policy);
  const status = routeStatus(record, paths, policy);
  const primaryPath = paths[0] ?? null;
  const priorState = record.action_state;
  const ready = status === COMMERCIAL_ROUTE_STATUSES.READY_FOR_HUMAN_REVIEW;
  const nextState = ready
    ? ACTION_STATES.HUMAN_REVIEW_REQUIRED
    : record.validation?.status !== VALIDATION_STATUS.VERIFIED
      ? ACTION_STATES.DISCOVERED
      : record.intelligence?.status === "SCORED"
        ? ACTION_STATES.STRATEGIC_MATCHED
        : ACTION_STATES.VALIDATED;
  const stateHistory = [...(record.state_history ?? [])];

  if (priorState !== nextState) {
    if (ready && priorState === ACTION_STATES.STRATEGIC_MATCHED) {
      stateHistory.push({
        from: ACTION_STATES.STRATEGIC_MATCHED,
        to: ACTION_STATES.REVENUE_PATH_IDENTIFIED,
        at: timestamp,
        actor,
        reason: `commercial path identified: ${primaryPath}`,
      });
      stateHistory.push({
        from: ACTION_STATES.REVENUE_PATH_IDENTIFIED,
        to: ACTION_STATES.HUMAN_REVIEW_REQUIRED,
        at: timestamp,
        actor,
        reason: "commercial route is actionable and requires explicit human review",
      });
    } else {
      stateHistory.push({
        from: priorState,
        to: nextState,
        at: timestamp,
        actor,
        reason: `commercialization route classified as ${status}`,
      });
    }
  }

  const updated = {
    ...record,
    commercialization: {
      status,
      policy_version: policy.version,
      candidate_paths: paths,
      primary_path: primaryPath,
      rationale: statusRationale(record, status, paths),
      evaluated_at: timestamp,
      treasury_labs_handoff: treasuryHandoff(status, policy),
    },
    revenue_path: primaryPath ?? record.revenue_path,
    action_state: nextState,
    state_history: stateHistory,
    updated_at: timestamp,
  };

  if (record.authorization?.status === "AUTHORIZED" || priorState === ACTION_STATES.AUTHORIZED_ACTION) {
    updated.authorization = resetAuthorization(record.authorization);
    if (!stateHistory.some((entry) => entry.from === ACTION_STATES.AUTHORIZED_ACTION)) {
      updated.state_history.push({
        from: ACTION_STATES.AUTHORIZED_ACTION,
        to: nextState,
        at: timestamp,
        actor,
        reason: "commercialization routing changed after authorization; fresh review required",
      });
    }
  }
  return updated;
}
