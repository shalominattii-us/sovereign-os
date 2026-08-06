import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ACTION_STATES,
  AUTHORIZATION_MODE,
  DEFAULT_SOURCE,
  EVENT_TYPES,
  VALIDATION_STATUS,
} from "./constants.js";
import { artifactHash, isoTimestamp } from "./canonical.js";
import { createAuthorization, applyAuthorization } from "./authorization.js";
import { createOpportunityEvent, persistOpportunityEvent, publishOpportunityEvent } from "./events.js";
import { InputValidationError } from "./errors.js";
import { mergeOpportunity, normalizeOpportunity } from "./normalizer.js";
import { validateBatchInput, validateNormalizedRecord } from "./schema.js";
import {
  applySourceEvidence,
  normalizeEvidenceItem,
  validateEvidenceBatch,
} from "./verification.js";
import { scoreOpportunity } from "./intelligence.js";
import { routeOpportunity } from "./commercialization.js";
import {
  acquireExclusiveLock,
  ensureDirectoryLayout,
  listJsonFiles,
  loadRecords,
  readJson,
  recordFilePath,
  removeRecordFile,
  writeJsonAtomic,
} from "./storage.js";

function createRunId(prefix, timestamp) {
  return `${prefix}_${timestamp.replace(/[-:.TZ]/g, "")}_${randomUUID().slice(0, 8)}`;
}

function setUniqueIndex(map, key, record) {
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, record);
  } else if (map.get(key)?.id !== record.id) {
    map.set(key, null);
  }
}

function buildRecordIndex(records) {
  const byId = new Map();
  const byKey = new Map();
  const byIdentifier = new Map();
  const byIssuerTitle = new Map();
  const byTitleHash = new Map();
  for (const record of records) {
    byId.set(record.id, record);
    byKey.set(record.deduplication_key, record);
    for (const alias of record.deduplication_aliases ?? []) byKey.set(alias, record);
    if (record.issuer && record.identifier) {
      setUniqueIndex(byIdentifier, `${record.issuer.toLowerCase()}|${record.identifier.toLowerCase()}`, record);
    }
    if (record.issuer && record.title_hash) {
      setUniqueIndex(byIssuerTitle, `${record.issuer.toLowerCase()}|${record.title_hash}`, record);
    }
    if (record.title_hash) setUniqueIndex(byTitleHash, record.title_hash, record);
  }
  return { byId, byKey, byIdentifier, byIssuerTitle, byTitleHash };
}

function findExisting(index, candidate) {
  const exact = index.byId.get(candidate.id) ?? index.byKey.get(candidate.deduplication_key);
  if (exact) return exact;
  if (candidate.issuer && candidate.identifier) {
    const identifierMatch = index.byIdentifier.get(
      `${candidate.issuer.toLowerCase()}|${candidate.identifier.toLowerCase()}`,
    );
    if (identifierMatch) return identifierMatch;
  }
  if (candidate.issuer && candidate.title_hash) {
    const issuerTitleMatch = index.byIssuerTitle.get(`${candidate.issuer.toLowerCase()}|${candidate.title_hash}`);
    if (issuerTitleMatch) return issuerTitleMatch;
  }
  if (candidate.title_hash) {
    const uniqueTitleMatch = index.byTitleHash.get(candidate.title_hash);
    if (uniqueTitleMatch && (!candidate.issuer || !uniqueTitleMatch.issuer)) return uniqueTitleMatch;
  }
  return null;
}

function updateIndex(index, record) {
  index.byId.set(record.id, record);
  index.byKey.set(record.deduplication_key, record);
  for (const alias of record.deduplication_aliases ?? []) index.byKey.set(alias, record);
  if (record.issuer && record.identifier) {
    setUniqueIndex(index.byIdentifier, `${record.issuer.toLowerCase()}|${record.identifier.toLowerCase()}`, record);
  }
  if (record.issuer && record.title_hash) {
    setUniqueIndex(index.byIssuerTitle, `${record.issuer.toLowerCase()}|${record.title_hash}`, record);
  }
  if (record.title_hash) setUniqueIndex(index.byTitleHash, record.title_hash, record);
}

async function persistRecordToStages(baseDir, record) {
  validateNormalizedRecord(record);
  await writeJsonAtomic(recordFilePath(baseDir, "normalized", record.id), record);

  if (record.validation.status === VALIDATION_STATUS.VERIFIED) {
    await writeJsonAtomic(recordFilePath(baseDir, "validated", record.id), record);
  } else {
    await removeRecordFile(baseDir, "validated", record.id);
  }

  if ([
    ACTION_STATES.STRATEGIC_MATCHED,
    ACTION_STATES.REVENUE_PATH_IDENTIFIED,
    ACTION_STATES.HUMAN_REVIEW_REQUIRED,
    ACTION_STATES.AUTHORIZED_ACTION,
  ].includes(record.action_state)) {
    await writeJsonAtomic(recordFilePath(baseDir, "strategic_queue", record.id), record);
  } else {
    await removeRecordFile(baseDir, "strategic_queue", record.id);
  }

  if ([
    ACTION_STATES.REVENUE_PATH_IDENTIFIED,
    ACTION_STATES.HUMAN_REVIEW_REQUIRED,
    ACTION_STATES.AUTHORIZED_ACTION,
  ].includes(record.action_state)) {
    await writeJsonAtomic(recordFilePath(baseDir, "commercial_pipeline", record.id), record);
  } else {
    await removeRecordFile(baseDir, "commercial_pipeline", record.id);
  }

  if (["cancelled", "awarded", "closed", "historical"].includes(record.record_status)
      || record.temporal_status === "CLOSED") {
    await writeJsonAtomic(recordFilePath(baseDir, "archive", record.id), record);
  } else {
    await removeRecordFile(baseDir, "archive", record.id);
  }
}

async function emitAndPublish({ baseDir, event, kernelUrl, kernelRequired, publishResults }) {
  await persistOpportunityEvent(baseDir, event);
  const result = await publishOpportunityEvent(event, kernelUrl, { required: kernelRequired });
  publishResults.push({ event_id: event.event_id, type: event.type, entity_id: event.entity_id, ...result });
}

export async function ingestBatch({
  baseDir,
  inputFile,
  source = DEFAULT_SOURCE,
  batch = null,
  mode = "normalize_validate",
  authorization = AUTHORIZATION_MODE,
  kernelUrl = null,
  kernelRequired = false,
  actor = "system:opportunity-intake",
}) {
  if (mode !== "normalize_validate") {
    throw new InputValidationError("Only normalize_validate mode is supported", { mode });
  }
  if (authorization !== AUTHORIZATION_MODE) {
    throw new InputValidationError("Opportunity intake requires human_required authorization", { authorization });
  }

  await ensureDirectoryLayout(baseDir);
  const releaseLock = await acquireExclusiveLock(baseDir, "ingest");
  const startedAt = isoTimestamp();
  const runId = createRunId("ingest", startedAt);
  const publishResults = [];
  const summary = {
    discovered: 0,
    merged: 0,
    verified: 0,
    review_queued: 0,
    archived: 0,
    needs_source_verification: 0,
  };

  try {
    const payload = await readJson(inputFile);
    if (!payload) throw new InputValidationError(`Input batch does not exist or is empty: ${inputFile}`);
    validateBatchInput(payload);
    const batchId = payload.batch_id;
    if (batch && batch !== payload.batch_id && batch !== payload.batch_date) {
      throw new InputValidationError("Requested batch does not match input payload", {
        requested_batch: batch,
        payload_batch_id: payload.batch_id,
        payload_batch_date: payload.batch_date,
      });
    }

    const currentRecords = await loadRecords(path.join(baseDir, "normalized"));
    const index = buildRecordIndex(currentRecords);
    const records = [];

    for (const input of payload.opportunities) {
      const timestamp = isoTimestamp();
      const candidate = normalizeOpportunity(input, { source, batchId, timestamp });
      const existing = findExisting(index, candidate);
      const record = existing
        ? mergeOpportunity(existing, candidate, {
            batchId,
            timestamp,
            mergeReason: input.lifecycle_note ?? "deduplication key or issuer/identifier match",
          })
        : candidate;
      await persistRecordToStages(baseDir, record);
      updateIndex(index, record);
      records.push(record);

      if (existing) summary.merged += 1;
      else summary.discovered += 1;
      if (record.validation.status === VALIDATION_STATUS.VERIFIED) summary.verified += 1;
      else summary.needs_source_verification += 1;
      if ([ACTION_STATES.HUMAN_REVIEW_REQUIRED, ACTION_STATES.AUTHORIZED_ACTION].includes(record.action_state)) {
        summary.review_queued += 1;
      }
      if (["cancelled", "awarded"].includes(record.record_status)) summary.archived += 1;

      const event = createOpportunityEvent({
        type: existing ? EVENT_TYPES.OPPORTUNITY_MERGED : EVENT_TYPES.OPPORTUNITY_DISCOVERED,
        entityId: record.id,
        source: "aegentix-cybercore-opportunity-intake",
        actor,
        correlationId: runId,
        payload: {
          record,
          batch_id: batchId,
          run_id: runId,
          authorization_mode: authorization,
          merge: existing ? { merged_into: existing.id, incoming_key: candidate.deduplication_key } : null,
        },
      });
      await emitAndPublish({ baseDir, event, kernelUrl, kernelRequired, publishResults });
    }

    const completedAt = isoTimestamp();
    const manifest = {
      run_id: runId,
      operation: "ingest",
      status: "COMPLETED",
      mode,
      authorization,
      source,
      batch_id: payload.batch_id,
      batch_selector: batch,
      input_file: path.relative(baseDir, inputFile),
      input_hash: artifactHash(payload),
      started_at: startedAt,
      completed_at: completedAt,
      summary,
      record_ids: records.map((record) => record.id),
      kernel_publication: {
        configured: Boolean(kernelUrl),
        required: kernelRequired,
        published: publishResults.filter((item) => item.published).length,
        failed: publishResults.filter((item) => item.attempted && !item.published).length,
        results: publishResults,
      },
    };
    manifest.manifest_hash = artifactHash(manifest);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.json`), manifest);
    return { manifest, records };
  } catch (error) {
    const failure = {
      run_id: runId,
      operation: "ingest",
      status: "FAILED",
      started_at: startedAt,
      failed_at: isoTimestamp(),
      error: { name: error.name, code: error.code ?? "UNEXPECTED_ERROR", message: error.message, details: error.details ?? null },
    };
    failure.manifest_hash = artifactHash(failure);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.failed.json`), failure).catch(() => {});
    throw error;
  } finally {
    await releaseLock();
  }
}

function resolveEvidenceTarget(records, evidence) {
  if (evidence.record_id) {
    const byId = records.find((record) => record.id === evidence.record_id);
    if (!byId) throw new InputValidationError(`Evidence record_id was not found: ${evidence.record_id}`);
    return byId;
  }
  const title = String(evidence.record_title ?? evidence.input_title ?? "").trim().toLowerCase();
  const matches = records.filter((record) => record.title.toLowerCase() === title);
  if (matches.length !== 1) {
    throw new InputValidationError("Evidence title must resolve to exactly one opportunity", {
      record_title: evidence.record_title ?? evidence.input_title ?? null,
      matches: matches.map((record) => record.id),
    });
  }
  return matches[0];
}

export async function verifyOpportunitySources({
  baseDir,
  evidenceFile,
  kernelUrl = null,
  kernelRequired = false,
  actor = "system:source-verification",
}) {
  await ensureDirectoryLayout(baseDir);
  const releaseLock = await acquireExclusiveLock(baseDir, "source-verification");
  const startedAt = isoTimestamp();
  const runId = createRunId("verify", startedAt);
  const publishResults = [];
  try {
    const payload = await readJson(evidenceFile);
    if (!payload) throw new InputValidationError(`Evidence batch does not exist or is empty: ${evidenceFile}`);
    validateEvidenceBatch(payload);
    payload.evidence.forEach((item) => normalizeEvidenceItem(item, {
      timestamp: payload.retrieved_at ?? startedAt,
    }));
    const records = await loadRecords(path.join(baseDir, "normalized"));
    if (records.length === 0) throw new InputValidationError("No normalized opportunities exist; run ingest first");

    const resolved = payload.evidence.map((item) => ({ item, record: resolveEvidenceTarget(records, item) }));
    const targetIds = resolved.map(({ record }) => record.id);
    if (new Set(targetIds).size !== targetIds.length) {
      throw new InputValidationError("Evidence batch contains more than one item for the same opportunity");
    }

    const updatedRecords = [];
    const summary = {
      processed: 0,
      verified: 0,
      needs_source_verification: 0,
      open: 0,
      deadline_today: 0,
      closed: 0,
      forecast: 0,
      program_only: 0,
      unknown: 0,
    };
    for (const { item, record } of resolved) {
      const timestamp = isoTimestamp();
      const updated = applySourceEvidence(record, item, { timestamp, actor });
      validateNormalizedRecord(updated);
      await persistRecordToStages(baseDir, updated);
      updatedRecords.push(updated);
      summary.processed += 1;
      if (updated.validation.status === VALIDATION_STATUS.VERIFIED) summary.verified += 1;
      else summary.needs_source_verification += 1;
      const temporalKey = updated.temporal_status.toLowerCase();
      summary[temporalKey] = (summary[temporalKey] ?? 0) + 1;

      const event = createOpportunityEvent({
        type: EVENT_TYPES.OPPORTUNITY_SOURCE_VERIFIED,
        entityId: updated.id,
        source: "aegentix-cybercore-source-verification",
        actor,
        correlationId: runId,
        payload: {
          record: updated,
          evidence_id: updated.validation.evidence_id,
          verification_status: updated.validation.status,
          temporal_status: updated.temporal_status,
          run_id: runId,
        },
      });
      await emitAndPublish({ baseDir, event, kernelUrl, kernelRequired, publishResults });
    }

    const manifest = {
      run_id: runId,
      operation: "source-verification",
      status: "COMPLETED",
      evidence_batch_id: payload.batch_id,
      evidence_file: path.relative(baseDir, evidenceFile),
      evidence_hash: artifactHash(payload),
      started_at: startedAt,
      completed_at: isoTimestamp(),
      summary,
      record_ids: updatedRecords.map((record) => record.id),
      kernel_publication: {
        configured: Boolean(kernelUrl),
        required: kernelRequired,
        published: publishResults.filter((item) => item.published).length,
        failed: publishResults.filter((item) => item.attempted && !item.published).length,
        results: publishResults,
      },
    };
    manifest.manifest_hash = artifactHash(manifest);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.json`), manifest);
    return { manifest, records: updatedRecords };
  } catch (error) {
    const failure = {
      run_id: runId,
      operation: "source-verification",
      status: "FAILED",
      started_at: startedAt,
      failed_at: isoTimestamp(),
      error: { name: error.name, code: error.code ?? "UNEXPECTED_ERROR", message: error.message, details: error.details ?? null },
    };
    failure.manifest_hash = artifactHash(failure);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.failed.json`), failure).catch(() => {});
    throw error;
  } finally {
    await releaseLock();
  }
}

function selectRecords(records, selector) {
  if (!selector || selector === "all") return records;
  const selected = records.filter((record) => record.id === selector);
  if (selected.length !== 1) throw new InputValidationError(`Opportunity record not found: ${selector}`);
  return selected;
}

export async function scoreOpportunities({
  baseDir,
  policyFile,
  recordSelector = "all",
  kernelUrl = null,
  kernelRequired = false,
  actor = "system:strategic-intelligence",
}) {
  await ensureDirectoryLayout(baseDir);
  const releaseLock = await acquireExclusiveLock(baseDir, "strategic-intelligence");
  const startedAt = isoTimestamp();
  const runId = createRunId("score", startedAt);
  const publishResults = [];
  try {
    const policy = await readJson(policyFile);
    if (!policy) throw new InputValidationError(`Intelligence policy does not exist: ${policyFile}`);
    const records = await loadRecords(path.join(baseDir, "normalized"));
    const selected = selectRecords(records, recordSelector);
    const updatedRecords = [];
    const summary = { selected: selected.length, scored: 0, skipped_unverified: 0, priorities: { P0: 0, P1: 0, P2: 0 } };

    for (const record of selected) {
      if (record.validation?.status !== VALIDATION_STATUS.VERIFIED) {
        if (recordSelector !== "all") {
          throw new InputValidationError("Selected record is not strictly VERIFIED", {
            record_id: record.id,
            validation_status: record.validation?.status ?? null,
          });
        }
        summary.skipped_unverified += 1;
        continue;
      }
      const updated = scoreOpportunity(record, policy, { timestamp: isoTimestamp(), actor });
      validateNormalizedRecord(updated);
      await persistRecordToStages(baseDir, updated);
      updatedRecords.push(updated);
      summary.scored += 1;
      summary.priorities[updated.priority] += 1;

      const event = createOpportunityEvent({
        type: EVENT_TYPES.OPPORTUNITY_INTELLIGENCE_SCORED,
        entityId: updated.id,
        source: "aegentix-cybercore-strategic-intelligence",
        actor,
        correlationId: runId,
        payload: {
          record: updated,
          intelligence: updated.intelligence,
          run_id: runId,
        },
      });
      await emitAndPublish({ baseDir, event, kernelUrl, kernelRequired, publishResults });
    }

    const manifest = {
      run_id: runId,
      operation: "strategic-intelligence",
      status: "COMPLETED",
      policy_version: policy.version,
      policy_file: path.relative(baseDir, policyFile),
      policy_hash: artifactHash(policy),
      record_selector: recordSelector,
      started_at: startedAt,
      completed_at: isoTimestamp(),
      summary,
      record_ids: updatedRecords.map((record) => record.id),
      kernel_publication: {
        configured: Boolean(kernelUrl),
        required: kernelRequired,
        published: publishResults.filter((item) => item.published).length,
        failed: publishResults.filter((item) => item.attempted && !item.published).length,
        results: publishResults,
      },
    };
    manifest.manifest_hash = artifactHash(manifest);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.json`), manifest);
    return { manifest, records: updatedRecords };
  } catch (error) {
    const failure = {
      run_id: runId,
      operation: "strategic-intelligence",
      status: "FAILED",
      policy_file: path.relative(baseDir, policyFile),
      record_selector: recordSelector,
      started_at: startedAt,
      failed_at: isoTimestamp(),
      error: { name: error.name, code: error.code ?? "UNEXPECTED_ERROR", message: error.message, details: error.details ?? null },
    };
    failure.manifest_hash = artifactHash(failure);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.failed.json`), failure).catch(() => {});
    throw error;
  } finally {
    await releaseLock();
  }
}

export async function routeOpportunities({
  baseDir,
  policyFile,
  recordSelector = "all",
  kernelUrl = null,
  kernelRequired = false,
  actor = "system:commercialization-routing",
}) {
  await ensureDirectoryLayout(baseDir);
  const releaseLock = await acquireExclusiveLock(baseDir, "commercialization-routing");
  const startedAt = isoTimestamp();
  const runId = createRunId("route", startedAt);
  const publishResults = [];
  try {
    const policy = await readJson(policyFile);
    if (!policy) throw new InputValidationError(`Commercialization policy does not exist: ${policyFile}`);
    const records = await loadRecords(path.join(baseDir, "normalized"));
    const selected = selectRecords(records, recordSelector);
    const missingScores = selected
      .filter((record) => record.validation?.status === VALIDATION_STATUS.VERIFIED)
      .filter((record) => record.intelligence?.status !== "SCORED")
      .map((record) => record.id);
    if (missingScores.length > 0) {
      throw new InputValidationError("Commercialization routing requires verified records to be scored first", {
        record_ids: missingScores,
      });
    }

    const updatedRecords = [];
    const summary = {
      selected: selected.length,
      routed: 0,
      ready_for_human_review: 0,
      treasury_handoffs_executed: 0,
      by_status: {},
    };
    for (const record of selected) {
      const updated = routeOpportunity(record, policy, { timestamp: isoTimestamp(), actor });
      validateNormalizedRecord(updated);
      await persistRecordToStages(baseDir, updated);
      updatedRecords.push(updated);
      summary.routed += 1;
      summary.by_status[updated.commercialization.status]
        = (summary.by_status[updated.commercialization.status] ?? 0) + 1;
      if (updated.commercialization.status === "READY_FOR_HUMAN_REVIEW") {
        summary.ready_for_human_review += 1;
      }

      const event = createOpportunityEvent({
        type: EVENT_TYPES.OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED,
        entityId: updated.id,
        source: "aegentix-cybercore-commercialization-routing",
        actor,
        correlationId: runId,
        payload: {
          record: updated,
          commercialization: updated.commercialization,
          treasury_handoff_executed: false,
          run_id: runId,
        },
      });
      await emitAndPublish({ baseDir, event, kernelUrl, kernelRequired, publishResults });
    }

    const manifest = {
      run_id: runId,
      operation: "commercialization-routing",
      status: "COMPLETED",
      policy_version: policy.version,
      policy_file: path.relative(baseDir, policyFile),
      policy_hash: artifactHash(policy),
      record_selector: recordSelector,
      started_at: startedAt,
      completed_at: isoTimestamp(),
      summary,
      record_ids: updatedRecords.map((record) => record.id),
      kernel_publication: {
        configured: Boolean(kernelUrl),
        required: kernelRequired,
        published: publishResults.filter((item) => item.published).length,
        failed: publishResults.filter((item) => item.attempted && !item.published).length,
        results: publishResults,
      },
    };
    manifest.manifest_hash = artifactHash(manifest);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.json`), manifest);
    return { manifest, records: updatedRecords };
  } catch (error) {
    const failure = {
      run_id: runId,
      operation: "commercialization-routing",
      status: "FAILED",
      policy_file: path.relative(baseDir, policyFile),
      record_selector: recordSelector,
      started_at: startedAt,
      failed_at: isoTimestamp(),
      error: { name: error.name, code: error.code ?? "UNEXPECTED_ERROR", message: error.message, details: error.details ?? null },
    };
    failure.manifest_hash = artifactHash(failure);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.failed.json`), failure).catch(() => {});
    throw error;
  } finally {
    await releaseLock();
  }
}

export async function authorizeOpportunity({
  baseDir,
  recordId,
  action,
  authorizedBy,
  reason,
  ticketReference = null,
  expiresAt = null,
  kernelUrl = null,
  kernelRequired = false,
}) {
  await ensureDirectoryLayout(baseDir);
  const releaseLock = await acquireExclusiveLock(baseDir, "authorize");
  const timestamp = isoTimestamp();
  const runId = createRunId("authorize", timestamp);
  try {
    const recordPath = recordFilePath(baseDir, "normalized", recordId);
    const record = await readJson(recordPath);
    if (!record) throw new InputValidationError(`Opportunity record not found: ${recordId}`);

    const artifact = createAuthorization(record, {
      action,
      authorized_by: authorizedBy,
      reason,
      ticket_reference: ticketReference,
      expires_at: expiresAt,
    }, { timestamp });
    const authorizedRecord = applyAuthorization(record, artifact);
    validateNormalizedRecord(authorizedRecord);
    await persistRecordToStages(baseDir, authorizedRecord);
    await writeJsonAtomic(path.join(baseDir, "authorizations", `${artifact.authorization_id}.json`), artifact);

    const event = createOpportunityEvent({
      type: EVENT_TYPES.OPPORTUNITY_AUTHORIZATION_RECORDED,
      entityId: recordId,
      actor: authorizedBy,
      correlationId: runId,
      payload: {
        authorization: artifact,
        action_state: authorizedRecord.action_state,
        record_id: recordId,
        run_id: runId,
      },
    });
    const publishResults = [];
    await emitAndPublish({ baseDir, event, kernelUrl, kernelRequired, publishResults });

    const manifest = {
      run_id: runId,
      operation: "authorize",
      status: "COMPLETED",
      record_id: recordId,
      authorization_id: artifact.authorization_id,
      action: artifact.action,
      authorized_by: artifact.authorized_by,
      completed_at: isoTimestamp(),
      kernel_publication: publishResults[0],
    };
    manifest.manifest_hash = artifactHash(manifest);
    await writeJsonAtomic(path.join(baseDir, "runs", `${runId}.json`), manifest);
    return { manifest, artifact, record: authorizedRecord };
  } finally {
    await releaseLock();
  }
}

export async function listOpportunities({ baseDir, priority = null, actionState = null, type = null }) {
  await ensureDirectoryLayout(baseDir);
  const records = await loadRecords(path.join(baseDir, "normalized"));
  return records
    .filter((record) => !priority || record.priority === priority)
    .filter((record) => !actionState || record.action_state === actionState)
    .filter((record) => !type || record.type === type)
    .sort((left, right) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2 };
      const byPriority = (priorityOrder[left.priority] ?? 9) - (priorityOrder[right.priority] ?? 9);
      return byPriority || left.title.localeCompare(right.title);
    });
}

export async function getIntakeStatus(baseDir) {
  await ensureDirectoryLayout(baseDir);
  const records = await loadRecords(path.join(baseDir, "normalized"));
  const runFiles = await listJsonFiles(path.join(baseDir, "runs"));
  const byState = {};
  const byPriority = {};
  const byValidation = {};
  const byTemporalStatus = {};
  const byCommercialStatus = {};
  for (const record of records) {
    byState[record.action_state] = (byState[record.action_state] ?? 0) + 1;
    byPriority[record.priority ?? "UNPRIORITIZED"] = (byPriority[record.priority ?? "UNPRIORITIZED"] ?? 0) + 1;
    byValidation[record.validation.status] = (byValidation[record.validation.status] ?? 0) + 1;
    byTemporalStatus[record.temporal_status ?? "UNKNOWN"]
      = (byTemporalStatus[record.temporal_status ?? "UNKNOWN"] ?? 0) + 1;
    byCommercialStatus[record.commercialization?.status ?? "NOT_EVALUATED"]
      = (byCommercialStatus[record.commercialization?.status ?? "NOT_EVALUATED"] ?? 0) + 1;
  }
  return {
    base_dir: baseDir,
    total_records: records.length,
    runs: runFiles.length,
    by_state: byState,
    by_priority: byPriority,
    by_validation: byValidation,
    by_temporal_status: byTemporalStatus,
    by_commercial_status: byCommercialStatus,
  };
}
