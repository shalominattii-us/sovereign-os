import { randomUUID } from "node:crypto";
import {
  ACTION_STATES,
  ALLOWED_TRANSITIONS,
  AUTHORIZATION_MODE,
  EXTERNAL_ACTIONS,
} from "./constants.js";
import { artifactHash, isoTimestamp, normalizeWhitespace } from "./canonical.js";
import { AuthorizationError, StateTransitionError } from "./errors.js";

export function reviewMaterialHash(record) {
  return artifactHash({
    schema_version: record.schema_version,
    id: record.id,
    deduplication_key: record.deduplication_key,
    deduplication_aliases: record.deduplication_aliases ?? [],
    title: record.title,
    source: {
      source_url: record.source?.source_url ?? null,
      source_checked_at: record.source?.source_checked_at ?? null,
    },
    source_evidence: record.source_evidence ?? [],
    official_title: record.official_title ?? null,
    issuer: record.issuer,
    jurisdiction: record.jurisdiction,
    type: record.type,
    program_type: record.program_type,
    procurement_type: record.procurement_type,
    market_entry: record.market_entry,
    sector: record.sector,
    identifier: record.identifier,
    publication_date: record.publication_date,
    deadline: record.deadline,
    value: record.value,
    eligibility: record.eligibility,
    compliance_requirements: record.compliance_requirements,
    registration_requirements: record.registration_requirements,
    submission_method: record.submission_method,
    attachments: record.attachments,
    strategic_fit: record.strategic_fit,
    revenue_path: record.revenue_path,
    revenue_probability: record.revenue_probability,
    priority: record.priority,
    route: record.route,
    temporal_status: record.temporal_status ?? "UNKNOWN",
    intelligence: record.intelligence ?? null,
    commercialization: record.commercialization ?? null,
    record_status: record.record_status,
    validation: {
      status: record.validation?.status ?? null,
      missing_fields: record.validation?.missing_fields ?? [],
      issues: record.validation?.issues ?? [],
      evidence_classification: record.validation?.evidence_classification ?? null,
      temporal_status: record.validation?.temporal_status ?? null,
      evidence_id: record.validation?.evidence_id ?? null,
      checks: record.validation?.checks ?? null,
    },
  });
}

function verifyAuthorizationArtifactIntegrity(artifact, recordId) {
  const { artifact_hash: suppliedHash, ...unsignedArtifact } = artifact ?? {};
  if (!suppliedHash || suppliedHash !== artifactHash(unsignedArtifact)) {
    throw new AuthorizationError("External action blocked: authorization artifact integrity check failed", {
      record_id: recordId,
    });
  }
}

export function transitionRecord(record, toState, { actor, reason, timestamp = isoTimestamp() }) {
  const allowed = ALLOWED_TRANSITIONS[record.action_state] ?? [];
  if (!allowed.includes(toState)) {
    throw new StateTransitionError(
      `Transition ${record.action_state} -> ${toState} is not allowed`,
      { record_id: record.id, from: record.action_state, to: toState },
    );
  }
  const normalizedActor = normalizeWhitespace(actor);
  const normalizedReason = normalizeWhitespace(reason);
  if (!normalizedActor || !normalizedReason) {
    throw new StateTransitionError("State transitions require both actor and reason", {
      record_id: record.id,
      actor,
      reason,
    });
  }
  return {
    ...record,
    action_state: toState,
    state_history: [
      ...(record.state_history ?? []),
      { from: record.action_state, to: toState, at: timestamp, actor: normalizedActor, reason: normalizedReason },
    ],
    updated_at: timestamp,
  };
}

export function createAuthorization(record, request, { timestamp = isoTimestamp() } = {}) {
  if (record.authorization?.mode !== AUTHORIZATION_MODE) {
    throw new AuthorizationError("Opportunity is not configured for mandatory human authorization", {
      record_id: record.id,
    });
  }
  if (record.action_state !== ACTION_STATES.HUMAN_REVIEW_REQUIRED) {
    throw new AuthorizationError("Opportunity is not ready for human authorization", {
      record_id: record.id,
      action_state: record.action_state,
      required_state: ACTION_STATES.HUMAN_REVIEW_REQUIRED,
    });
  }

  const action = normalizeWhitespace(request.action);
  const authorizedBy = normalizeWhitespace(request.authorized_by);
  const reason = normalizeWhitespace(request.reason);
  const ticketReference = normalizeWhitespace(request.ticket_reference);
  if (!EXTERNAL_ACTIONS.includes(action)) {
    throw new AuthorizationError("Requested action is not a recognized controlled external action", {
      action,
      allowed_actions: EXTERNAL_ACTIONS,
    });
  }
  if (!authorizedBy?.startsWith("human:") || authorizedBy.length <= "human:".length) {
    throw new AuthorizationError("authorized_by must identify a human actor using human:<identifier>", {
      authorized_by: authorizedBy,
    });
  }
  if (!reason) {
    throw new AuthorizationError("Human authorization requires a documented reason");
  }

  const defaultExpiry = new Date(new Date(timestamp).valueOf() + 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = request.expires_at ? isoTimestamp(request.expires_at) : defaultExpiry;
  if (new Date(expiresAt).valueOf() <= new Date(timestamp).valueOf()) {
    throw new AuthorizationError("Authorization expiry must be in the future", { expires_at: expiresAt });
  }

  const reviewSnapshotHash = reviewMaterialHash(record);
  const artifact = {
    authorization_id: `auth_${randomUUID()}`,
    version: 1,
    record_id: record.id,
    action,
    authorized_by: authorizedBy,
    reason,
    ticket_reference: ticketReference,
    authorized_at: timestamp,
    expires_at: expiresAt,
    review_snapshot_hash: reviewSnapshotHash,
    mode: AUTHORIZATION_MODE,
  };
  artifact.artifact_hash = artifactHash(artifact);
  return artifact;
}

export function applyAuthorization(record, artifact) {
  if (artifact.record_id !== record.id) {
    throw new AuthorizationError("Authorization artifact is bound to a different opportunity", {
      record_id: record.id,
      artifact_record_id: artifact.record_id,
    });
  }
  if (artifact.review_snapshot_hash !== reviewMaterialHash(record)) {
    throw new AuthorizationError("Opportunity changed after review; fresh human authorization is required", {
      record_id: record.id,
    });
  }
  verifyAuthorizationArtifactIntegrity(artifact, record.id);

  const authorized = transitionRecord(record, ACTION_STATES.AUTHORIZED_ACTION, {
    actor: artifact.authorized_by,
    reason: `Authorized ${artifact.action}: ${artifact.reason}`,
    timestamp: artifact.authorized_at,
  });
  return {
    ...authorized,
    authorization: {
      ...authorized.authorization,
      status: "AUTHORIZED",
      approved_action: artifact.action,
      authorization_id: artifact.authorization_id,
      authorized_by: artifact.authorized_by,
      authorized_at: artifact.authorized_at,
      expires_at: artifact.expires_at,
      review_snapshot_hash: artifact.review_snapshot_hash,
      artifact_hash: artifact.artifact_hash,
    },
  };
}

export function assertAuthorizedExternalAction(record, artifact, action, { timestamp = isoTimestamp() } = {}) {
  if (record.action_state !== ACTION_STATES.AUTHORIZED_ACTION) {
    throw new AuthorizationError("External action blocked: record is not in AUTHORIZED_ACTION", {
      record_id: record.id,
      action_state: record.action_state,
    });
  }
  if (!artifact || artifact.authorization_id !== record.authorization.authorization_id) {
    throw new AuthorizationError("External action blocked: authorization artifact is missing or mismatched", {
      record_id: record.id,
    });
  }
  verifyAuthorizationArtifactIntegrity(artifact, record.id);
  if (artifact.review_snapshot_hash !== reviewMaterialHash(record)) {
    throw new AuthorizationError("External action blocked: opportunity changed after human review", {
      record_id: record.id,
    });
  }
  if (artifact.action !== action || record.authorization.approved_action !== action) {
    throw new AuthorizationError("External action blocked: action is outside authorization scope", {
      record_id: record.id,
      requested_action: action,
      authorized_action: artifact.action,
    });
  }
  if (new Date(artifact.expires_at).valueOf() <= new Date(timestamp).valueOf()) {
    throw new AuthorizationError("External action blocked: authorization has expired", {
      record_id: record.id,
      expires_at: artifact.expires_at,
    });
  }
  return true;
}
