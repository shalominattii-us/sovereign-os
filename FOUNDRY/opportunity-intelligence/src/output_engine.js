import fs from "node:fs/promises";
import path from "node:path";

import {
  artifactHash,
  isoTimestamp,
} from "../../../CYBERCORE/opportunity_intake/src/canonical.js";

export const OUTPUT_SCHEMA_VERSION = "aegentix.foundry.opportunity-output.v1";
export const OUTPUT_INDEX_SCHEMA_VERSION = "aegentix.foundry.opportunity-output-index.v1";

export const MATURITY_STAGES = Object.freeze({
  DISCOVERED: { order: 10, terminal: false },
  SOURCE_DISCOVERY: { order: 20, terminal: false },
  SOURCE_VERIFIED: { order: 30, terminal: false },
  STRATEGIC_INTELLIGENCE: { order: 40, terminal: false },
  FORECAST_MONITOR: { order: 45, terminal: false },
  PROGRAM_DISCOVERY: { order: 45, terminal: false },
  HUMAN_REVIEW: { order: 50, terminal: false },
  AUTHORIZED_SCOPE_RECORDED: { order: 60, terminal: false },
  CLOSED: { order: 90, terminal: true },
});

function maturityStage(record) {
  if (record.action_state === "AUTHORIZED_ACTION") return "AUTHORIZED_SCOPE_RECORDED";
  switch (record.commercialization?.status) {
    case "READY_FOR_HUMAN_REVIEW": return "HUMAN_REVIEW";
    case "CLOSED_NO_ACTION": return "CLOSED";
    case "MONITOR_FORECAST": return "FORECAST_MONITOR";
    case "PROGRAM_DISCOVERY_ONLY": return "PROGRAM_DISCOVERY";
    case "SOURCE_VERIFICATION_REQUIRED": return "SOURCE_DISCOVERY";
    default: break;
  }
  if (record.intelligence?.status === "SCORED") return "STRATEGIC_INTELLIGENCE";
  if (record.validation?.status === "VERIFIED") return "SOURCE_VERIFIED";
  if (record.validation?.status === "NEEDS_SOURCE_VERIFICATION") return "SOURCE_DISCOVERY";
  return "DISCOVERED";
}

function decisionFor(record, stage) {
  if (stage === "AUTHORIZED_SCOPE_RECORDED") {
    return {
      disposition: "DOWNSTREAM_EXECUTOR_MUST_REVERIFY_AUTHORIZATION",
      human_decision_required: false,
      actionable: true,
      reason: "A scoped authorization is recorded, but Foundry never executes the authorized action.",
    };
  }
  if (stage === "HUMAN_REVIEW") {
    return {
      disposition: "REQUIRES_HUMAN_DECISION",
      human_decision_required: true,
      actionable: true,
      reason: "Verified, scored, and commercially routed; explicit human review is required.",
    };
  }
  if (stage === "CLOSED") {
    return {
      disposition: "NO_ACTION_HISTORICAL",
      human_decision_required: false,
      actionable: false,
      reason: "The authoritative opportunity deadline has passed or the record is terminal.",
    };
  }
  if (stage === "FORECAST_MONITOR") {
    return {
      disposition: "MONITOR_FORECAST",
      human_decision_required: false,
      actionable: false,
      reason: "The record is a forecast and is not open for action.",
    };
  }
  if (stage === "PROGRAM_DISCOVERY") {
    return {
      disposition: "DISCOVER_SPECIFIC_CHILD_OPPORTUNITY",
      human_decision_required: false,
      actionable: false,
      reason: "The evidence identifies a program or category rather than one actionable opportunity.",
    };
  }
  if (stage === "SOURCE_DISCOVERY") {
    return {
      disposition: "REQUIRES_AUTHORITATIVE_SOURCE_EVIDENCE",
      human_decision_required: false,
      actionable: false,
      reason: "Issuer, identifier, deadline, or specific authoritative match remains incomplete.",
    };
  }
  return {
    disposition: "CONTINUE_INTERNAL_PIPELINE",
    human_decision_required: false,
    actionable: false,
    reason: "The record has not yet reached a human review boundary.",
  };
}

function summarizeRecord(record) {
  return {
    id: record.id,
    title: record.title,
    issuer: record.issuer,
    identifier: record.identifier,
    deadline: record.deadline,
    opportunity_type: record.opportunity_type ?? record.type ?? null,
    sector: record.sector ?? null,
    priority: record.priority ?? null,
    action_state: record.action_state,
    validation_status: record.validation?.status ?? null,
    temporal_status: record.temporal_status ?? "UNKNOWN",
    intelligence_score: record.intelligence?.score ?? null,
    intelligence_policy_version: record.intelligence?.policy_version ?? null,
    commercial_status: record.commercialization?.status ?? "NOT_EVALUATED",
    primary_path: record.commercialization?.primary_path ?? null,
    candidate_paths: record.commercialization?.candidate_paths ?? [],
  };
}

export function createOpportunityOutputBundle(record, {
  generatedAt = isoTimestamp(),
  pipelineRunId = null,
} = {}) {
  if (!record?.id || !record?.title) {
    throw new TypeError("Foundry output requires a canonical OpportunityRecord with id and title");
  }
  const stage = maturityStage(record);
  const unsigned = {
    schema_version: OUTPUT_SCHEMA_VERSION,
    bundle_id: null,
    generated_at: isoTimestamp(generatedAt),
    output_type: "CYBERCORE_OPPORTUNITY_MATURITY",
    source: {
      pipeline: "CYBERCORE/opportunity_intake",
      pipeline_run_id: pipelineRunId,
      record_id: record.id,
      record_hash: artifactHash(record),
    },
    maturity: {
      stage,
      order: MATURITY_STAGES[stage].order,
      terminal: MATURITY_STAGES[stage].terminal,
    },
    decision: decisionFor(record, stage),
    summary: summarizeRecord(record),
    treasury_labs: {
      status: record.commercialization?.treasury_labs_handoff?.status ?? "BLOCKED",
      automatic_dispatch: false,
      handoff_executed: false,
    },
    safety: {
      external_action_executed: false,
      output_is_decision_support_only: true,
      authorization_required_for_external_action: true,
    },
    record_snapshot: record,
  };
  const identityHash = artifactHash({
    schema_version: unsigned.schema_version,
    generated_at: unsigned.generated_at,
    record_hash: unsigned.source.record_hash,
    maturity: unsigned.maturity,
    decision: unsigned.decision,
  });
  unsigned.bundle_id = `foundry_output_${identityHash.slice(0, 24)}`;
  const bundle = { ...unsigned, artifact_hash: null };
  bundle.artifact_hash = artifactHash({ ...bundle, artifact_hash: null });
  return bundle;
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}

export async function emitOpportunityOutputs(records, {
  outputDir,
  generatedAt = isoTimestamp(),
  pipelineRunId = null,
} = {}) {
  if (!outputDir) throw new TypeError("Foundry outputDir is required");
  if (!Array.isArray(records)) throw new TypeError("Foundry records must be an array");

  await fs.mkdir(outputDir, { recursive: true });
  const existingFiles = await fs.readdir(outputDir);
  await Promise.all(existingFiles
    .filter((name) => name.endsWith(".maturity.json") || name === "index.json")
    .map((name) => fs.rm(path.join(outputDir, name), { force: true })));

  const bundles = records
    .map((record) => createOpportunityOutputBundle(record, { generatedAt, pipelineRunId }))
    .sort((left, right) => left.source.record_id.localeCompare(right.source.record_id));

  const files = [];
  for (const bundle of bundles) {
    const fileName = `${bundle.source.record_id}.maturity.json`;
    await writeJsonAtomic(path.join(outputDir, fileName), bundle);
    files.push({
      record_id: bundle.source.record_id,
      bundle_id: bundle.bundle_id,
      artifact_hash: bundle.artifact_hash,
      maturity_stage: bundle.maturity.stage,
      relative_path: fileName,
    });
  }

  const byMaturity = {};
  const byDisposition = {};
  for (const bundle of bundles) {
    byMaturity[bundle.maturity.stage] = (byMaturity[bundle.maturity.stage] ?? 0) + 1;
    byDisposition[bundle.decision.disposition] = (byDisposition[bundle.decision.disposition] ?? 0) + 1;
  }

  const index = {
    schema_version: OUTPUT_INDEX_SCHEMA_VERSION,
    output_run_id: `foundry_output_run_${artifactHash({ generatedAt, files }).slice(0, 24)}`,
    generated_at: isoTimestamp(generatedAt),
    pipeline_run_id: pipelineRunId,
    total_outputs: bundles.length,
    by_maturity: byMaturity,
    by_disposition: byDisposition,
    human_review_required: bundles.filter((bundle) => bundle.decision.human_decision_required).length,
    automatic_dispatches: 0,
    external_actions_executed: 0,
    files,
    artifact_hash: null,
  };
  index.artifact_hash = artifactHash({ ...index, artifact_hash: null });
  await writeJsonAtomic(path.join(outputDir, "index.json"), index);
  return { index, bundles };
}
