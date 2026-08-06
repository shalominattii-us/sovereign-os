import {
  ACTION_STATES,
  AUTHORIZATION_MODE,
  EXTERNAL_ACTIONS,
  RECORD_SCHEMA_VERSION,
  ROUTES,
  STATE_ORDER,
  STRATEGIC_TIERS,
  VALIDATION_STATUS,
} from "./constants.js";
import {
  buildDeduplicationKey,
  isoTimestamp,
  normalizeIsoDate,
  normalizeWhitespace,
  opportunityIdFromKey,
  titleHash,
  uniqueStrings,
} from "./canonical.js";
import { assessSourceVerification, validateNormalizedRecord } from "./schema.js";
import { reviewMaterialHash, transitionRecord } from "./authorization.js";

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStrategicFit(value, score) {
  const label = normalizeWhitespace(typeof value === "object" ? value?.tier ?? value?.label : value);
  const explicitScore = nullableNumber(score ?? (typeof value === "object" ? value?.score : null));
  const known = Object.values(STRATEGIC_TIERS).find((item) => item.label.toLowerCase() === label?.toLowerCase());
  if (known) return { tier: known.label, score: explicitScore ?? known.score };
  return { tier: label ?? STRATEGIC_TIERS.UNASSESSED.label, score: explicitScore };
}

function normalizeValue(input) {
  if (input.value && typeof input.value === "object" && !Array.isArray(input.value)) {
    return {
      amount: nullableNumber(input.value.amount),
      currency: normalizeWhitespace(input.value.currency),
      description: normalizeWhitespace(input.value.description),
    };
  }
  return {
    amount: nullableNumber(input.funding_amount),
    currency: normalizeWhitespace(input.funding_currency),
    description: normalizeWhitespace(input.funding_amount_description),
  };
}

function normalizedSource(input, context) {
  return {
    channel: normalizeWhitespace(input.source) ?? context.source,
    batch_id: context.batchId,
    source_url: normalizeWhitespace(input.source_url),
    source_checked_at: input.source_checked_at ? isoTimestamp(input.source_checked_at) : null,
  };
}

function nextStateCandidate(record) {
  if (record.validation.status !== VALIDATION_STATUS.VERIFIED) return ACTION_STATES.DISCOVERED;
  if (record.strategic_fit.score === null && record.strategic_fit.tier === STRATEGIC_TIERS.UNASSESSED.label) {
    return ACTION_STATES.VALIDATED;
  }
  if (!record.revenue_path) return ACTION_STATES.STRATEGIC_MATCHED;
  if (!record.priority) return ACTION_STATES.REVENUE_PATH_IDENTIFIED;
  return ACTION_STATES.HUMAN_REVIEW_REQUIRED;
}

function advanceInternalState(record, timestamp) {
  const candidate = nextStateCandidate(record);
  const currentIndex = STATE_ORDER.indexOf(record.action_state);
  const candidateIndex = STATE_ORDER.indexOf(candidate);
  if (candidateIndex <= currentIndex || record.action_state === ACTION_STATES.AUTHORIZED_ACTION) return record;

  const history = [...record.state_history];
  for (let index = currentIndex + 1; index <= candidateIndex; index += 1) {
    history.push({
      from: STATE_ORDER[index - 1],
      to: STATE_ORDER[index],
      at: timestamp,
      actor: "system:opportunity-intake",
      reason: "deterministic internal classification",
    });
  }
  return { ...record, action_state: candidate, state_history: history };
}

export function normalizeOpportunity(input, context) {
  const timestamp = context.timestamp ?? isoTimestamp();
  const title = normalizeWhitespace(input.title);
  const deduplicationKey = buildDeduplicationKey({
    issuer: input.issuer,
    identifier: input.identifier,
    title,
    deadline: normalizeIsoDate(input.deadline),
  });
  const id = opportunityIdFromKey(deduplicationKey);
  const type = input.opportunity_type;
  const strategicFit = normalizeStrategicFit(input.strategic_fit, input.strategic_score);
  const source = normalizedSource(input, context);

  let record = {
    schema_version: RECORD_SCHEMA_VERSION,
    id,
    deduplication_key: deduplicationKey,
    deduplication_aliases: [],
    title_hash: titleHash(title),
    title,
    source,
    issuer: normalizeWhitespace(input.issuer),
    jurisdiction: normalizeWhitespace(input.jurisdiction),
    type,
    program_type: normalizeWhitespace(input.program_type),
    procurement_type: normalizeWhitespace(input.procurement_type),
    market_entry: normalizeWhitespace(input.market_entry),
    sector: normalizeWhitespace(input.sector),
    identifier: normalizeWhitespace(input.identifier),
    publication_date: normalizeIsoDate(input.publication_date),
    deadline: normalizeIsoDate(input.deadline),
    value: normalizeValue(input),
    eligibility: uniqueStrings(input.eligibility),
    compliance_requirements: uniqueStrings(input.compliance_requirements),
    registration_requirements: uniqueStrings(input.registration_requirements),
    submission_method: normalizeWhitespace(input.submission_method),
    attachments: uniqueStrings(input.attachments),
    strategic_fit: strategicFit,
    strategic_score: strategicFit.score,
    revenue_path: normalizeWhitespace(input.revenue_path),
    revenue_probability: nullableNumber(input.revenue_probability),
    priority: normalizeWhitespace(input.priority),
    route: type === "procurement" ? ROUTES.PROCUREMENT : ROUTES.FUNDING_GRANTS,
    record_status: normalizeWhitespace(input.record_status)?.toLowerCase() ?? "unknown",
    action_state: ACTION_STATES.DISCOVERED,
    state_history: [{
      from: null,
      to: ACTION_STATES.DISCOVERED,
      at: timestamp,
      actor: "system:opportunity-intake",
      reason: "record normalized from intake payload",
    }],
    lifecycle_history: [{
      status: normalizeWhitespace(input.record_status)?.toLowerCase() ?? "unknown",
      at: timestamp,
      source_batch_id: context.batchId,
      note: normalizeWhitespace(input.lifecycle_note),
    }],
    validation: null,
    authorization: {
      mode: AUTHORIZATION_MODE,
      status: "PENDING",
      prohibited_automatic_actions: [...EXTERNAL_ACTIONS],
      approved_action: null,
      authorization_id: null,
      authorized_by: null,
      authorized_at: null,
      expires_at: null,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };

  record.validation = assessSourceVerification({
    issuer: record.issuer,
    identifier: record.identifier,
    source_url: record.source.source_url,
    source_checked_at: record.source.source_checked_at,
  });
  record = advanceInternalState(record, timestamp);
  validateNormalizedRecord(record);
  return record;
}

function preferIncoming(existing, incoming) {
  return incoming === null || incoming === undefined || incoming === "" ? existing : incoming;
}

export function mergeOpportunity(existing, incoming, context) {
  const timestamp = context.timestamp ?? isoTimestamp();
  const merged = {
    ...existing,
    deduplication_aliases: uniqueStrings([
      ...(existing.deduplication_aliases ?? []),
      ...(incoming.deduplication_key !== existing.deduplication_key ? [incoming.deduplication_key] : []),
      ...(incoming.deduplication_aliases ?? []),
    ]),
    title: preferIncoming(existing.title, incoming.title),
    source: {
      channel: preferIncoming(existing.source?.channel, incoming.source?.channel),
      batch_id: context.batchId,
      source_url: preferIncoming(existing.source?.source_url, incoming.source?.source_url),
      source_checked_at: preferIncoming(existing.source?.source_checked_at, incoming.source?.source_checked_at),
    },
    issuer: preferIncoming(existing.issuer, incoming.issuer),
    jurisdiction: preferIncoming(existing.jurisdiction, incoming.jurisdiction),
    type: preferIncoming(existing.type, incoming.type),
    program_type: preferIncoming(existing.program_type, incoming.program_type),
    procurement_type: preferIncoming(existing.procurement_type, incoming.procurement_type),
    market_entry: preferIncoming(existing.market_entry, incoming.market_entry),
    sector: preferIncoming(existing.sector, incoming.sector),
    identifier: preferIncoming(existing.identifier, incoming.identifier),
    publication_date: preferIncoming(existing.publication_date, incoming.publication_date),
    deadline: preferIncoming(existing.deadline, incoming.deadline),
    value: {
      amount: preferIncoming(existing.value?.amount, incoming.value?.amount),
      currency: preferIncoming(existing.value?.currency, incoming.value?.currency),
      description: preferIncoming(existing.value?.description, incoming.value?.description),
    },
    eligibility: uniqueStrings([...(existing.eligibility ?? []), ...(incoming.eligibility ?? [])]),
    compliance_requirements: uniqueStrings([
      ...(existing.compliance_requirements ?? []),
      ...(incoming.compliance_requirements ?? []),
    ]),
    registration_requirements: uniqueStrings([
      ...(existing.registration_requirements ?? []),
      ...(incoming.registration_requirements ?? []),
    ]),
    submission_method: preferIncoming(existing.submission_method, incoming.submission_method),
    attachments: uniqueStrings([...(existing.attachments ?? []), ...(incoming.attachments ?? [])]),
    strategic_fit: incoming.strategic_fit?.score !== null
      || incoming.strategic_fit?.tier !== STRATEGIC_TIERS.UNASSESSED.label
      ? incoming.strategic_fit
      : existing.strategic_fit,
    strategic_score: incoming.strategic_score ?? existing.strategic_score,
    revenue_path: preferIncoming(existing.revenue_path, incoming.revenue_path),
    revenue_probability: incoming.revenue_probability ?? existing.revenue_probability,
    priority: preferIncoming(existing.priority, incoming.priority),
    route: incoming.route ?? existing.route,
    record_status: incoming.record_status === "unknown" ? existing.record_status : incoming.record_status,
    lifecycle_history: [
      ...(existing.lifecycle_history ?? []),
      {
        status: incoming.record_status,
        at: timestamp,
        source_batch_id: context.batchId,
        note: context.mergeReason ?? "duplicate key merged",
      },
    ],
    updated_at: timestamp,
  };

  merged.validation = assessSourceVerification({
    issuer: merged.issuer,
    identifier: merged.identifier,
    source_url: merged.source.source_url,
    source_checked_at: merged.source.source_checked_at,
  });
  let advanced = advanceInternalState(merged, timestamp);
  if (
    existing.action_state === ACTION_STATES.AUTHORIZED_ACTION
    && reviewMaterialHash(existing) !== reviewMaterialHash(advanced)
  ) {
    advanced = transitionRecord(advanced, ACTION_STATES.HUMAN_REVIEW_REQUIRED, {
      actor: "system:opportunity-intake",
      reason: "material opportunity data changed after authorization",
      timestamp,
    });
    advanced.authorization = {
      ...advanced.authorization,
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
  validateNormalizedRecord(advanced);
  return advanced;
}
