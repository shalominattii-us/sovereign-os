import {
  ACTION_STATES,
  AUTHORIZATION_MODE,
  COMMERCIAL_PATHS,
  COMMERCIAL_ROUTE_STATUSES,
  EVIDENCE_CLASSIFICATIONS,
  MARKET_ENTRY_TYPES,
  OPPORTUNITY_TYPES,
  PROCUREMENT_TYPES,
  PRIORITIES,
  RECORD_STATUSES,
  ROUTES,
  TEMPORAL_STATUSES,
  TREASURY_HANDOFF_STATUSES,
  VALIDATION_STATUS,
} from "./constants.js";
import { InputValidationError } from "./errors.js";

const URL_PATTERN = /^https:\/\//i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isStringOrNull(value) {
  return value === null || value === undefined || typeof value === "string";
}

function isFiniteNumberOrNull(value) {
  return value === null || value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function issue(path, message) {
  return { path, message };
}

function isScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function validateBatchInput(batch) {
  const issues = [];
  if (!batch || typeof batch !== "object" || Array.isArray(batch)) {
    throw new InputValidationError("Batch payload must be a JSON object");
  }
  if (typeof batch.batch_id !== "string" || batch.batch_id.trim().length === 0) {
    issues.push(issue("batch_id", "must be a non-empty string"));
  }
  if (!Array.isArray(batch.opportunities) || batch.opportunities.length === 0) {
    issues.push(issue("opportunities", "must be a non-empty array"));
  } else {
    batch.opportunities.forEach((record, index) => {
      issues.push(...validateInputOpportunity(record).map((item) => ({
        path: `opportunities[${index}].${item.path}`,
        message: item.message,
      })));
    });
  }
  if (issues.length > 0) {
    throw new InputValidationError("Batch payload failed structural validation", issues);
  }
  return true;
}

export function validateInputOpportunity(record) {
  const issues = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return [issue("record", "must be an object")];
  }
  if (typeof record.title !== "string" || record.title.trim().length === 0) {
    issues.push(issue("title", "must be a non-empty string"));
  }
  if (!OPPORTUNITY_TYPES.includes(record.opportunity_type)) {
    issues.push(issue("opportunity_type", `must be one of: ${OPPORTUNITY_TYPES.join(", ")}`));
  }
  if (!isStringOrNull(record.issuer)) issues.push(issue("issuer", "must be a string or null"));
  if (!isStringOrNull(record.identifier)) issues.push(issue("identifier", "must be a string or null"));
  if (!isStringOrNull(record.deadline)) issues.push(issue("deadline", "must be a string or null"));
  if (!isStringOrNull(record.publication_date)) issues.push(issue("publication_date", "must be a string or null"));
  if (!isStringOrNull(record.source_url)) issues.push(issue("source_url", "must be a string or null"));
  if (record.source_url && !URL_PATTERN.test(record.source_url)) {
    issues.push(issue("source_url", "must use HTTPS"));
  }
  if (record.procurement_type && !PROCUREMENT_TYPES.includes(record.procurement_type)) {
    issues.push(issue("procurement_type", `must be one of: ${PROCUREMENT_TYPES.join(", ")}`));
  }
  if (record.market_entry && !MARKET_ENTRY_TYPES.includes(record.market_entry)) {
    issues.push(issue("market_entry", `must be one of: ${MARKET_ENTRY_TYPES.join(", ")}`));
  }
  if (record.priority && !Object.values(PRIORITIES).includes(record.priority)) {
    issues.push(issue("priority", `must be one of: ${Object.values(PRIORITIES).join(", ")}`));
  }
  if (record.record_status && !RECORD_STATUSES.includes(record.record_status)) {
    issues.push(issue("record_status", `must be one of: ${RECORD_STATUSES.join(", ")}`));
  }
  if (!isFiniteNumberOrNull(record.funding_amount)) {
    issues.push(issue("funding_amount", "must be a finite number or null"));
  }
  if (!isFiniteNumberOrNull(record.revenue_probability)) {
    issues.push(issue("revenue_probability", "must be a finite number or null"));
  } else if (record.revenue_probability !== null && record.revenue_probability !== undefined
      && (record.revenue_probability < 0 || record.revenue_probability > 1)) {
    issues.push(issue("revenue_probability", "must be between 0 and 1"));
  }
  return issues;
}

export function validateNormalizedRecord(record) {
  const issues = [];
  if (!/^opp_[a-f0-9]{24}$/.test(record.id ?? "")) issues.push(issue("id", "must be a deterministic opportunity ID"));
  if (!record.deduplication_key) issues.push(issue("deduplication_key", "is required"));
  if (!Array.isArray(record.deduplication_aliases)) issues.push(issue("deduplication_aliases", "must be an array"));
  if (!record.title) issues.push(issue("title", "is required"));
  if (!OPPORTUNITY_TYPES.includes(record.type)) issues.push(issue("type", "is invalid"));
  if (!Object.values(ROUTES).includes(record.route)) issues.push(issue("route", "is invalid"));
  if (!Object.values(ACTION_STATES).includes(record.action_state)) issues.push(issue("action_state", "is invalid"));
  if (!RECORD_STATUSES.includes(record.record_status)) issues.push(issue("record_status", "is invalid"));
  if (record.priority && !Object.values(PRIORITIES).includes(record.priority)) issues.push(issue("priority", "is invalid"));
  if (record.procurement_type && !PROCUREMENT_TYPES.includes(record.procurement_type)) {
    issues.push(issue("procurement_type", "is invalid"));
  }
  if (record.market_entry && !MARKET_ENTRY_TYPES.includes(record.market_entry)) {
    issues.push(issue("market_entry", "is invalid"));
  }

  for (const field of [
    "eligibility",
    "compliance_requirements",
    "registration_requirements",
    "attachments",
    "state_history",
    "lifecycle_history",
  ]) {
    if (!Array.isArray(record[field])) issues.push(issue(field, "must be an array"));
  }

  if (!record.value || typeof record.value !== "object" || Array.isArray(record.value)) {
    issues.push(issue("value", "must be an object"));
  } else {
    if (!isFiniteNumberOrNull(record.value.amount) || (record.value.amount !== null && record.value.amount < 0)) {
      issues.push(issue("value.amount", "must be a non-negative finite number or null"));
    }
    if (!isStringOrNull(record.value.currency)) issues.push(issue("value.currency", "must be a string or null"));
    if (!isStringOrNull(record.value.description)) issues.push(issue("value.description", "must be a string or null"));
  }

  if (!record.strategic_fit || typeof record.strategic_fit !== "object") {
    issues.push(issue("strategic_fit", "must be an object"));
  } else if (!isFiniteNumberOrNull(record.strategic_fit.score)
      || (record.strategic_fit.score !== null && (record.strategic_fit.score < 0 || record.strategic_fit.score > 100))) {
    issues.push(issue("strategic_fit.score", "must be between 0 and 100 or null"));
  }
  if (!isFiniteNumberOrNull(record.revenue_probability)
      || (record.revenue_probability !== null && (record.revenue_probability < 0 || record.revenue_probability > 1))) {
    issues.push(issue("revenue_probability", "must be between 0 and 1 or null"));
  }

  if (!record.source || typeof record.source !== "object" || !record.source.channel || !record.source.batch_id) {
    issues.push(issue("source", "must include channel and batch_id"));
  } else {
    if (record.source.source_url && !URL_PATTERN.test(record.source.source_url)) {
      issues.push(issue("source.source_url", "must use HTTPS"));
    }
    if (record.source.source_checked_at && !ISO_TIMESTAMP_PATTERN.test(record.source.source_checked_at)) {
      issues.push(issue("source.source_checked_at", "must be an ISO timestamp"));
    }
  }

  if (!Array.isArray(record.source_evidence)) {
    issues.push(issue("source_evidence", "must be an array"));
  } else {
    record.source_evidence.forEach((evidence, index) => {
      const prefix = `source_evidence[${index}]`;
      if (!/^evidence_[a-f0-9]{24}$/.test(evidence?.evidence_id ?? "")) {
        issues.push(issue(`${prefix}.evidence_id`, "must be a deterministic evidence ID"));
      }
      if (!EVIDENCE_CLASSIFICATIONS.includes(evidence?.classification)) {
        issues.push(issue(`${prefix}.classification`, "is invalid"));
      }
      if (!Array.isArray(evidence?.source_urls) || evidence.source_urls.some((url) => !URL_PATTERN.test(url))) {
        issues.push(issue(`${prefix}.source_urls`, "must be an array of HTTPS URLs"));
      }
      if (!ISO_TIMESTAMP_PATTERN.test(evidence?.retrieved_at ?? "")) {
        issues.push(issue(`${prefix}.retrieved_at`, "must be an ISO timestamp"));
      }
      for (const check of ["issuer_verified", "identifier_verified", "deadline_verified"]) {
        if (typeof evidence?.checks?.[check] !== "boolean") {
          issues.push(issue(`${prefix}.checks.${check}`, "must be a boolean"));
        }
      }
      if (typeof evidence?.confidence !== "number" || evidence.confidence < 0 || evidence.confidence > 1) {
        issues.push(issue(`${prefix}.confidence`, "must be between 0 and 1"));
      }
    });
  }

  if (!TEMPORAL_STATUSES.includes(record.temporal_status)) {
    issues.push(issue("temporal_status", "is invalid"));
  }

  if (!record.intelligence || typeof record.intelligence !== "object" || Array.isArray(record.intelligence)) {
    issues.push(issue("intelligence", "must be an object"));
  } else {
    if (!["NOT_EVALUATED", "SCORED"].includes(record.intelligence.status)) {
      issues.push(issue("intelligence.status", "must be NOT_EVALUATED or SCORED"));
    }
    if (record.intelligence.status === "SCORED") {
      for (const dimension of [
        "sector_fit",
        "revenue_probability",
        "funding_probability",
        "implementation_complexity",
        "strategic_alignment",
      ]) {
        if (!isScore(record.intelligence.dimensions?.[dimension])) {
          issues.push(issue(`intelligence.dimensions.${dimension}`, "must be between 0 and 100"));
        }
      }
      if (!isScore(record.intelligence.score)) issues.push(issue("intelligence.score", "must be between 0 and 100"));
      if (!Object.values(PRIORITIES).includes(record.intelligence.recommended_priority)) {
        issues.push(issue("intelligence.recommended_priority", "is invalid"));
      }
      if (!Array.isArray(record.intelligence.explanation)) {
        issues.push(issue("intelligence.explanation", "must be an array"));
      }
      if (!ISO_TIMESTAMP_PATTERN.test(record.intelligence.scored_at ?? "")) {
        issues.push(issue("intelligence.scored_at", "must be an ISO timestamp"));
      }
    }
  }

  if (!record.commercialization || typeof record.commercialization !== "object"
      || Array.isArray(record.commercialization)) {
    issues.push(issue("commercialization", "must be an object"));
  } else {
    if (!Object.values(COMMERCIAL_ROUTE_STATUSES).includes(record.commercialization.status)) {
      issues.push(issue("commercialization.status", "is invalid"));
    }
    if (!Array.isArray(record.commercialization.candidate_paths)
        || record.commercialization.candidate_paths.some((path) => !COMMERCIAL_PATHS.includes(path))) {
      issues.push(issue("commercialization.candidate_paths", "must contain recognized paths"));
    }
    if (record.commercialization.primary_path
        && !COMMERCIAL_PATHS.includes(record.commercialization.primary_path)) {
      issues.push(issue("commercialization.primary_path", "is invalid"));
    }
    if (!Array.isArray(record.commercialization.rationale)) {
      issues.push(issue("commercialization.rationale", "must be an array"));
    }
    if (!Object.values(TREASURY_HANDOFF_STATUSES).includes(record.commercialization.treasury_labs_handoff?.status)) {
      issues.push(issue("commercialization.treasury_labs_handoff.status", "is invalid"));
    }
    if (record.commercialization.status === "READY_FOR_HUMAN_REVIEW") {
      if (record.validation?.status !== VALIDATION_STATUS.VERIFIED) {
        issues.push(issue("commercialization.status", "ready routing requires VERIFIED source status"));
      }
      if (!["OPEN", "DEADLINE_TODAY"].includes(record.temporal_status)) {
        issues.push(issue("commercialization.status", "ready routing requires an actionable temporal status"));
      }
      if (record.intelligence?.status !== "SCORED" || !record.commercialization.primary_path) {
        issues.push(issue("commercialization.status", "ready routing requires a score and primary path"));
      }
      if (record.commercialization.treasury_labs_handoff?.status !== "HUMAN_APPROVAL_REQUIRED") {
        issues.push(issue("commercialization.treasury_labs_handoff.status", "must require human approval"));
      }
    }
  }

  if (!Object.values(VALIDATION_STATUS).includes(record.validation?.status)) {
    issues.push(issue("validation.status", "is invalid"));
  }
  if (!Array.isArray(record.validation?.missing_fields)) issues.push(issue("validation.missing_fields", "must be an array"));
  if (!Array.isArray(record.validation?.issues)) issues.push(issue("validation.issues", "must be an array"));
  if (record.validation?.evidence_classification
      && !EVIDENCE_CLASSIFICATIONS.includes(record.validation.evidence_classification)) {
    issues.push(issue("validation.evidence_classification", "is invalid"));
  }
  if (record.validation?.temporal_status
      && !TEMPORAL_STATUSES.includes(record.validation.temporal_status)) {
    issues.push(issue("validation.temporal_status", "is invalid"));
  }
  if (record.validation?.status === VALIDATION_STATUS.VERIFIED
      && (!Array.isArray(record.source_evidence) || record.source_evidence.length === 0)) {
    issues.push(issue("source_evidence", "VERIFIED records require authoritative evidence"));
  }

  if (record.authorization?.mode !== AUTHORIZATION_MODE) {
    issues.push(issue("authorization.mode", `must equal ${AUTHORIZATION_MODE}`));
  }
  if (!Array.isArray(record.authorization?.prohibited_automatic_actions)) {
    issues.push(issue("authorization.prohibited_automatic_actions", "must be an array"));
  }
  if (!["PENDING", "AUTHORIZED"].includes(record.authorization?.status)) {
    issues.push(issue("authorization.status", "must be PENDING or AUTHORIZED"));
  }
  if (record.action_state === ACTION_STATES.AUTHORIZED_ACTION) {
    if (record.authorization?.status !== "AUTHORIZED") issues.push(issue("authorization.status", "must be AUTHORIZED"));
    if (!record.authorization?.authorization_id) issues.push(issue("authorization.authorization_id", "is required"));
    if (!record.authorization?.approved_action) issues.push(issue("authorization.approved_action", "is required"));
    if (!record.authorization?.authorized_by?.startsWith("human:")) {
      issues.push(issue("authorization.authorized_by", "must identify a human actor"));
    }
  } else if (record.authorization?.status === "AUTHORIZED") {
    issues.push(issue("authorization.status", "cannot be AUTHORIZED outside AUTHORIZED_ACTION state"));
  }

  if (!ISO_TIMESTAMP_PATTERN.test(record.created_at ?? "")) issues.push(issue("created_at", "must be an ISO timestamp"));
  if (!ISO_TIMESTAMP_PATTERN.test(record.updated_at ?? "")) issues.push(issue("updated_at", "must be an ISO timestamp"));
  if (record.publication_date && !ISO_DATE_PATTERN.test(record.publication_date)) {
    issues.push(issue("publication_date", "must be an ISO date when provided"));
  }
  if (record.deadline && !ISO_DATE_PATTERN.test(record.deadline)) {
    issues.push(issue("deadline", "must be an ISO date when provided"));
  }
  if (issues.length > 0) {
    throw new InputValidationError("Normalized opportunity failed validation", issues);
  }
  return true;
}

export function assessSourceVerification(record) {
  const missing = [];
  if (!record.issuer) missing.push("issuer");
  if (!record.identifier) missing.push("identifier");
  if (!record.source_url) missing.push("source_url");
  if (!record.source_checked_at) missing.push("source_checked_at");
  if (!Array.isArray(record.source_evidence) || record.source_evidence.length === 0) {
    missing.push("source_evidence");
  }

  const invalid = [];
  if (record.source_url && !URL_PATTERN.test(record.source_url)) invalid.push("source_url must use HTTPS");
  if (record.source_checked_at && !ISO_TIMESTAMP_PATTERN.test(record.source_checked_at)) {
    invalid.push("source_checked_at must be an ISO timestamp");
  }

  if (invalid.length > 0) {
    return {
      status: VALIDATION_STATUS.INVALID,
      missing_fields: missing,
      issues: invalid,
      validated_at: null,
    };
  }

  if (missing.length > 0) {
    return {
      status: VALIDATION_STATUS.NEEDS_SOURCE_VERIFICATION,
      missing_fields: missing,
      issues: [],
      validated_at: null,
    };
  }

  return {
    status: VALIDATION_STATUS.VERIFIED,
    missing_fields: [],
    issues: [],
    validated_at: new Date().toISOString(),
  };
}
