import {
  ACTION_STATES,
  COMMERCIAL_ROUTE_STATUSES,
  EVIDENCE_CLASSIFICATIONS,
  EVIDENCE_SCHEMA_VERSION,
  INTELLIGENCE_POLICY_VERSION,
  TEMPORAL_STATUSES,
  TREASURY_HANDOFF_STATUSES,
  VALIDATION_STATUS,
} from "./constants.js";
import {
  artifactHash,
  isoTimestamp,
  normalizeIsoDate,
  normalizeWhitespace,
  uniqueStrings,
} from "./canonical.js";
import { reviewMaterialHash } from "./authorization.js";
import { InputValidationError } from "./errors.js";

const HTTPS_PATTERN = /^https:\/\//i;
const VERIFIED_SPECIFIC_CLASSIFICATIONS = new Set([
  "VERIFIED_ACTIVE",
  "VERIFIED_FORECAST",
  "HISTORICAL",
]);

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredText(value, field) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) throw new InputValidationError(`Evidence ${field} must be a non-empty string`);
  return normalized;
}

function optionalText(value) {
  return normalizeWhitespace(value) ?? null;
}

function booleanValue(value, field) {
  if (typeof value !== "boolean") {
    throw new InputValidationError(`Evidence ${field} must be a boolean`);
  }
  return value;
}

export function validateEvidenceBatch(batch) {
  if (!batch || typeof batch !== "object" || Array.isArray(batch)) {
    throw new InputValidationError("Evidence batch must be a JSON object");
  }
  if (!normalizeWhitespace(batch.batch_id)) {
    throw new InputValidationError("Evidence batch requires batch_id");
  }
  if (!Array.isArray(batch.evidence) || batch.evidence.length === 0) {
    throw new InputValidationError("Evidence batch requires a non-empty evidence array");
  }
  return true;
}

export function normalizeEvidenceItem(input, {
  timestamp = isoTimestamp(),
  recordId = null,
  recordTitle = null,
} = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new InputValidationError("Evidence item must be an object");
  }
  const classification = requiredText(input.classification, "classification").toUpperCase();
  if (!EVIDENCE_CLASSIFICATIONS.includes(classification)) {
    throw new InputValidationError("Evidence classification is invalid", {
      classification,
      allowed: EVIDENCE_CLASSIFICATIONS,
    });
  }

  const sourceUrls = uniqueStrings(input.source_urls ?? (input.source_url ? [input.source_url] : []));
  const invalidUrls = sourceUrls.filter((url) => !HTTPS_PATTERN.test(url));
  if (invalidUrls.length > 0) {
    throw new InputValidationError("Evidence source URLs must use HTTPS", { invalid_urls: invalidUrls });
  }

  const retrievedAt = isoTimestamp(input.retrieved_at ?? timestamp);
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    evidence_id: null,
    record_id: optionalText(input.record_id ?? recordId),
    record_title: optionalText(input.record_title ?? input.input_title ?? recordTitle),
    classification,
    source_authority: optionalText(input.source_authority),
    source_urls: sourceUrls,
    retrieved_at: retrievedAt,
    official: {
      title: optionalText(input.official_title ?? input.recommended_title),
      issuer: optionalText(input.issuer ?? input.authoritative_issuer),
      identifier: optionalText(input.identifier),
      publication_date: normalizeIsoDate(input.publication_date),
      deadline: normalizeIsoDate(input.deadline),
      status: optionalText(input.official_status),
      value: {
        amount: nullableNumber(input.value_amount),
        currency: optionalText(input.value_currency),
        description: optionalText(input.value_description ?? input.funding_or_value),
      },
      eligibility: uniqueStrings(input.eligibility),
      submission_method: optionalText(input.submission_method),
    },
    checks: {
      issuer_verified: booleanValue(input.issuer_verified, "issuer_verified"),
      identifier_verified: booleanValue(input.identifier_verified, "identifier_verified"),
      deadline_verified: booleanValue(input.deadline_verified, "deadline_verified"),
    },
    evidence_summary: requiredText(input.evidence_summary, "evidence_summary"),
    confidence: nullableNumber(input.confidence),
  };

  if (!evidence.record_id && !evidence.record_title) {
    throw new InputValidationError("Evidence item requires record_id or record_title");
  }
  if (evidence.confidence === null || evidence.confidence < 0 || evidence.confidence > 1) {
    throw new InputValidationError("Evidence confidence must be between 0 and 1");
  }
  if (classification !== "NO_AUTHORITATIVE_MATCH" && sourceUrls.length === 0) {
    throw new InputValidationError("Matched evidence requires at least one authoritative source URL");
  }
  if (sourceUrls.length > 0 && !evidence.source_authority) {
    throw new InputValidationError("Matched evidence requires source_authority");
  }

  const unsigned = { ...evidence };
  delete unsigned.evidence_id;
  evidence.evidence_id = `evidence_${artifactHash(unsigned).slice(0, 24)}`;
  return evidence;
}

export function evaluateTemporalStatus(evidence, { timestamp = isoTimestamp() } = {}) {
  if (evidence.classification === "VERIFIED_FORECAST") return "FORECAST";
  if (["VERIFIED_PROGRAM", "GENERIC_CATEGORY"].includes(evidence.classification)) return "PROGRAM_ONLY";
  if (evidence.classification === "NO_AUTHORITATIVE_MATCH") return "UNKNOWN";
  if (evidence.classification === "HISTORICAL") return "CLOSED";
  if (!evidence.official.deadline) return "UNKNOWN";

  const evaluationDate = timestamp.slice(0, 10);
  if (evidence.official.deadline < evaluationDate) return "CLOSED";
  if (evidence.official.deadline === evaluationDate) return "DEADLINE_TODAY";
  return "OPEN";
}

export function assessEvidenceVerification(evidence, { timestamp = isoTimestamp() } = {}) {
  const missing = [];
  const issues = [];
  if (!evidence.source_authority) missing.push("source_authority");
  if (evidence.source_urls.length === 0) missing.push("source_urls");
  if (!evidence.official.issuer) missing.push("issuer");
  if (!evidence.official.identifier) missing.push("identifier");
  if (!evidence.official.deadline) missing.push("deadline");
  if (!evidence.checks.issuer_verified) missing.push("issuer_verified");
  if (!evidence.checks.identifier_verified) missing.push("identifier_verified");
  if (!evidence.checks.deadline_verified) missing.push("deadline_verified");
  if (!VERIFIED_SPECIFIC_CLASSIFICATIONS.has(evidence.classification)) {
    issues.push(`classification ${evidence.classification} is not a specific verifiable opportunity`);
  }
  if (!TEMPORAL_STATUSES.includes(evaluateTemporalStatus(evidence, { timestamp }))) {
    issues.push("temporal status could not be determined");
  }

  const verified = missing.length === 0 && issues.length === 0;
  return {
    status: verified ? VALIDATION_STATUS.VERIFIED : VALIDATION_STATUS.NEEDS_SOURCE_VERIFICATION,
    missing_fields: missing,
    issues,
    validated_at: verified ? timestamp : null,
    evidence_classification: evidence.classification,
    temporal_status: evaluateTemporalStatus(evidence, { timestamp }),
    evidence_id: evidence.evidence_id,
    checks: { ...evidence.checks },
  };
}

function resetAuthorization(record) {
  return {
    ...record.authorization,
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

function resetIntelligence() {
  return {
    status: "NOT_EVALUATED",
    policy_version: INTELLIGENCE_POLICY_VERSION,
    dimensions: null,
    score: null,
    recommended_priority: null,
    explanation: [],
    scored_at: null,
  };
}

function resetCommercialization() {
  return {
    status: COMMERCIAL_ROUTE_STATUSES.NOT_EVALUATED,
    policy_version: null,
    candidate_paths: [],
    primary_path: null,
    rationale: [],
    evaluated_at: null,
    treasury_labs_handoff: {
      status: TREASURY_HANDOFF_STATUSES.NOT_EVALUATED,
      reason: "source evidence changed; commercialization routing must be reevaluated",
    },
  };
}

function recordStatusFor(temporalStatus, existingStatus) {
  if (["OPEN", "DEADLINE_TODAY"].includes(temporalStatus)) return "active";
  if (temporalStatus === "FORECAST") return "forecast";
  if (temporalStatus === "CLOSED") return "historical";
  if (temporalStatus === "PROGRAM_ONLY") return "program";
  return existingStatus ?? "unknown";
}

export function applySourceEvidence(record, input, { timestamp = isoTimestamp(), actor = "system:source-verification" } = {}) {
  const evidence = normalizeEvidenceItem(input, {
    timestamp,
    recordId: record.id,
    recordTitle: record.title,
  });
  const validation = assessEvidenceVerification(evidence, { timestamp });
  const priorHash = reviewMaterialHash(record);
  const evidenceIndex = new Map((record.source_evidence ?? []).map((item) => [item.evidence_id, item]));
  evidenceIndex.set(evidence.evidence_id, evidence);

  const updated = {
    ...record,
    schema_version: "2.0.0",
    source: {
      ...record.source,
      source_url: evidence.source_urls[0] ?? record.source?.source_url ?? null,
      source_checked_at: evidence.retrieved_at,
    },
    source_evidence: [...evidenceIndex.values()],
    official_title: evidence.official.title ?? record.official_title ?? null,
    issuer: evidence.official.issuer ?? record.issuer,
    identifier: evidence.official.identifier ?? record.identifier,
    publication_date: evidence.official.publication_date ?? record.publication_date,
    deadline: evidence.official.deadline ?? record.deadline,
    value: {
      amount: evidence.official.value.amount ?? record.value?.amount ?? null,
      currency: evidence.official.value.currency ?? record.value?.currency ?? null,
      description: evidence.official.value.description ?? record.value?.description ?? null,
    },
    eligibility: uniqueStrings([...(record.eligibility ?? []), ...evidence.official.eligibility]),
    submission_method: evidence.official.submission_method ?? record.submission_method,
    validation,
    temporal_status: validation.temporal_status,
    intelligence: resetIntelligence(),
    commercialization: resetCommercialization(),
    record_status: recordStatusFor(validation.temporal_status, record.record_status),
    updated_at: timestamp,
  };

  const targetState = validation.status === VALIDATION_STATUS.VERIFIED
    ? ACTION_STATES.VALIDATED
    : ACTION_STATES.DISCOVERED;
  if (targetState !== record.action_state) {
    updated.action_state = targetState;
    updated.state_history = [
      ...(record.state_history ?? []),
      {
        from: record.action_state,
        to: targetState,
        at: timestamp,
        actor,
        reason: validation.status === VALIDATION_STATUS.VERIFIED
          ? "authoritative source evidence satisfied strict verification"
          : "source evidence does not satisfy strict opportunity verification",
      },
    ];
  }

  if (record.authorization?.status === "AUTHORIZED" && priorHash !== reviewMaterialHash(updated)) {
    updated.authorization = resetAuthorization(updated);
    if (updated.action_state === ACTION_STATES.AUTHORIZED_ACTION) {
      updated.action_state = validation.status === VALIDATION_STATUS.VERIFIED
        ? ACTION_STATES.VALIDATED
        : ACTION_STATES.DISCOVERED;
      updated.state_history = [
        ...(updated.state_history ?? []),
        {
          from: ACTION_STATES.AUTHORIZED_ACTION,
          to: updated.action_state,
          at: timestamp,
          actor,
          reason: "source evidence changed after authorization; fresh review required",
        },
      ];
    }
  }
  return updated;
}
