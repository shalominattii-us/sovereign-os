#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  authorizeOpportunity,
  getIntakeStatus,
  ingestBatch,
  listOpportunities,
  routeOpportunities,
  scoreOpportunities,
  verifyOpportunitySources,
} from "../src/engine.js";
import { AUTHORIZATION_MODE, DEFAULT_SOURCE, EXTERNAL_ACTIONS } from "../src/constants.js";

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

function parseArguments(argv) {
  const args = [...argv];
  const positionals = [];
  const options = {};
  while (args.length > 0) {
    const token = args.shift();
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = toCamelCase(rawKey);
    if (inlineValue !== undefined && inlineValue !== "") {
      options[key] = inlineValue;
    } else if (args[0] && !args[0].startsWith("--")) {
      options[key] = args.shift();
    } else {
      options[key] = true;
    }
  }
  return { positionals, options };
}

function requireOption(options, key, command) {
  if (!options[key] || options[key] === true) {
    throw new Error(`${command} requires --${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`);
  }
  return options[key];
}

function inputPath(options) {
  if (options.input) return path.resolve(process.cwd(), options.input);
  const batch = options.batch ?? "2026-08-06";
  const defaultName = `AEGENTIX-CYBERCORE-OPP-INTAKE-${batch}.json`;
  return path.join(MODULE_ROOT, "incoming", defaultName);
}

function evidencePath(options) {
  if (options.evidence) return path.resolve(process.cwd(), options.evidence);
  return path.join(MODULE_ROOT, "evidence", "source-verification-2026-08-06.json");
}

function policyPath(options) {
  if (options.policy) return path.resolve(process.cwd(), options.policy);
  return path.join(MODULE_ROOT, "policy", "intelligence-policy-v1.json");
}

function commercializationPolicyPath(options) {
  if (options.commercializationPolicy) return path.resolve(process.cwd(), options.commercializationPolicy);
  return path.join(MODULE_ROOT, "policy", "commercialization-policy-v1.json");
}

function kernelOptions(options) {
  return {
    kernelUrl: options.kernelUrl === "off"
      ? null
      : options.kernelUrl ?? process.env.KERNEL_EVENT_BUS_URL ?? null,
    kernelRequired: options.kernelRequired === true,
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printRecords(records) {
  if (records.length === 0) {
    console.log("No matching opportunities.");
    return;
  }
  const rows = records.map((record) => ({
    ID: record.id,
    Priority: record.priority ?? "-",
    State: record.action_state,
    Validation: record.validation.status,
    Temporal: record.temporal_status ?? "UNKNOWN",
    Score: record.intelligence?.score ?? "-",
    Commercial: record.commercialization?.status ?? "NOT_EVALUATED",
    Type: record.type,
    Title: record.title,
  }));
  console.table(rows);
}

function help() {
  console.log(`
AEGENTIX Cybercore Opportunity Intake

Usage:
  aegentix_cybercore_ingest [ingest] [options]
  aegentix_cybercore_ingest verify [--evidence FILE] [options]
  aegentix_cybercore_ingest score [--record all|RECORD_ID] [--policy FILE] [options]
  aegentix_cybercore_ingest route [--record all|RECORD_ID] [--commercialization-policy FILE] [options]
  aegentix_cybercore_ingest pipeline [--evidence FILE] [--policy FILE] [--commercialization-policy FILE] [options]
  aegentix_cybercore_ingest list [--priority P0|P1|P2] [--state STATE] [--type TYPE] [--json]
  aegentix_cybercore_ingest status [--json]
  aegentix_cybercore_ingest authorize <record-id> --action ACTION --authorized-by human:<id> --reason TEXT [options]

Ingest options:
  --source NAME                 Source label (default: ${DEFAULT_SOURCE})
  --batch ID                    Batch date or payload ID (default: 2026-08-06)
  --input FILE                  Batch JSON file; defaults from --batch
  --mode normalize_validate     Required deterministic mode
  --authorization ${AUTHORIZATION_MODE}
                                Mandatory authorization policy
  --actor ACTOR                 Event actor (default: system:opportunity-intake)
  --kernel-url URL              Publish events to a running Kernel /intent endpoint
  --kernel-required             Fail the run if Kernel publication fails

Verification options:
  --evidence FILE               Evidence batch JSON; defaults to the bundled 2026-08-06 research
  --actor ACTOR                 Event actor (default: system:source-verification)
  --kernel-url URL              Publish verification events to a running Kernel
  --kernel-required             Fail the run if Kernel publication fails

Scoring options:
  --record all|RECORD_ID        Score all verified records or one record (default: all)
  --policy FILE                 Versioned deterministic scoring policy
  --actor ACTOR                 Event actor (default: system:strategic-intelligence)
  --kernel-url URL              Publish scoring events to a running Kernel
  --kernel-required             Fail the run if Kernel publication fails

Routing and pipeline options:
  --record all|RECORD_ID        Route all records or one record (default: all)
  --commercialization-policy FILE
                                Versioned commercialization route policy
  --evidence FILE               Evidence batch used by pipeline
  --policy FILE                 Intelligence policy used by pipeline
  --kernel-url URL              Publish all pipeline events to a running Kernel
  --kernel-required             Fail the operation if Kernel publication fails

Authorization options:
  --action ACTION               One of: ${EXTERNAL_ACTIONS.join(", ")}
  --authorized-by human:<id>    Explicit human actor identifier
  --reason TEXT                 Documented authorization rationale
  --ticket-reference VALUE      Optional approval ticket or decision reference
  --expires-at ISO_TIMESTAMP    Optional expiry; defaults to 24 hours

Safety invariant:
  Ingestion never submits applications, registers accounts, places bids, signs contracts,
  makes financial commitments, or sends external communications. The authorize command
  records a scoped human decision; it does not execute the approved external action.
`);
}

async function runIngest(options) {
  const result = await ingestBatch({
    baseDir: MODULE_ROOT,
    inputFile: inputPath(options),
    source: options.source ?? DEFAULT_SOURCE,
    batch: options.batch ?? null,
    mode: options.mode ?? "normalize_validate",
    authorization: options.authorization ?? AUTHORIZATION_MODE,
    actor: options.actor ?? "system:opportunity-intake",
    ...kernelOptions(options),
  });
  printJson({
    status: result.manifest.status,
    run_id: result.manifest.run_id,
    batch_id: result.manifest.batch_id,
    summary: result.manifest.summary,
    manifest: path.join("runs", `${result.manifest.run_id}.json`),
    kernel_publication: {
      configured: result.manifest.kernel_publication.configured,
      required: result.manifest.kernel_publication.required,
      published: result.manifest.kernel_publication.published,
      failed: result.manifest.kernel_publication.failed,
    },
  });
}

async function runVerify(options) {
  const result = await verifyOpportunitySources({
    baseDir: MODULE_ROOT,
    evidenceFile: evidencePath(options),
    actor: options.actor ?? "system:source-verification",
    ...kernelOptions(options),
  });
  printJson({
    status: result.manifest.status,
    run_id: result.manifest.run_id,
    evidence_batch_id: result.manifest.evidence_batch_id,
    summary: result.manifest.summary,
    manifest: path.join("runs", `${result.manifest.run_id}.json`),
    kernel_publication: {
      configured: result.manifest.kernel_publication.configured,
      required: result.manifest.kernel_publication.required,
      published: result.manifest.kernel_publication.published,
      failed: result.manifest.kernel_publication.failed,
    },
  });
}

async function runScore(options) {
  const result = await scoreOpportunities({
    baseDir: MODULE_ROOT,
    policyFile: policyPath(options),
    recordSelector: options.record ?? "all",
    actor: options.actor ?? "system:strategic-intelligence",
    ...kernelOptions(options),
  });
  printJson({
    status: result.manifest.status,
    run_id: result.manifest.run_id,
    policy_version: result.manifest.policy_version,
    summary: result.manifest.summary,
    manifest: path.join("runs", `${result.manifest.run_id}.json`),
    kernel_publication: {
      configured: result.manifest.kernel_publication.configured,
      required: result.manifest.kernel_publication.required,
      published: result.manifest.kernel_publication.published,
      failed: result.manifest.kernel_publication.failed,
    },
  });
}

async function runRoute(options) {
  const result = await routeOpportunities({
    baseDir: MODULE_ROOT,
    policyFile: commercializationPolicyPath(options),
    recordSelector: options.record ?? "all",
    actor: options.actor ?? "system:commercialization-routing",
    ...kernelOptions(options),
  });
  printJson({
    status: result.manifest.status,
    run_id: result.manifest.run_id,
    policy_version: result.manifest.policy_version,
    summary: result.manifest.summary,
    manifest: path.join("runs", `${result.manifest.run_id}.json`),
    note: "No Treasury Labs handoff or external action was executed.",
  });
}

async function runPipeline(options) {
  const kernel = kernelOptions(options);
  const verification = await verifyOpportunitySources({
    baseDir: MODULE_ROOT,
    evidenceFile: evidencePath(options),
    actor: options.actor ?? "system:intelligence-pipeline",
    ...kernel,
  });
  const scoring = await scoreOpportunities({
    baseDir: MODULE_ROOT,
    policyFile: policyPath(options),
    recordSelector: options.record ?? "all",
    actor: options.actor ?? "system:intelligence-pipeline",
    ...kernel,
  });
  const routing = await routeOpportunities({
    baseDir: MODULE_ROOT,
    policyFile: commercializationPolicyPath(options),
    recordSelector: options.record ?? "all",
    actor: options.actor ?? "system:intelligence-pipeline",
    ...kernel,
  });
  printJson({
    status: "COMPLETED",
    verification: { run_id: verification.manifest.run_id, summary: verification.manifest.summary },
    scoring: { run_id: scoring.manifest.run_id, summary: scoring.manifest.summary },
    routing: { run_id: routing.manifest.run_id, summary: routing.manifest.summary },
    treasury_handoffs_executed: 0,
    note: "Ready records require explicit human authorization; no external action was executed.",
  });
}

async function runAuthorize(positionals, options) {
  const recordId = positionals[0];
  if (!recordId) throw new Error("authorize requires <record-id>");
  const result = await authorizeOpportunity({
    baseDir: MODULE_ROOT,
    recordId,
    action: requireOption(options, "action", "authorize"),
    authorizedBy: requireOption(options, "authorizedBy", "authorize"),
    reason: requireOption(options, "reason", "authorize"),
    ticketReference: options.ticketReference ?? null,
    expiresAt: options.expiresAt ?? null,
    ...kernelOptions(options),
  });
  printJson({
    status: result.manifest.status,
    record_id: result.record.id,
    action_state: result.record.action_state,
    authorization_id: result.artifact.authorization_id,
    expires_at: result.artifact.expires_at,
    note: "Authorization recorded; no external action was executed.",
  });
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  let [command, ...positionals] = parsed.positionals;
  if (!command || command.startsWith("--")) command = "ingest";
  if (!["ingest", "verify", "score", "route", "pipeline", "list", "status", "authorize", "help"].includes(command)) {
    positionals = [command, ...positionals];
    command = "ingest";
  }

  switch (command) {
    case "ingest":
      await runIngest(parsed.options);
      break;
    case "verify":
      await runVerify(parsed.options);
      break;
    case "score":
      await runScore(parsed.options);
      break;
    case "route":
      await runRoute(parsed.options);
      break;
    case "pipeline":
      await runPipeline(parsed.options);
      break;
    case "list": {
      const records = await listOpportunities({
        baseDir: MODULE_ROOT,
        priority: parsed.options.priority ?? null,
        actionState: parsed.options.state ?? null,
        type: parsed.options.type ?? null,
      });
      parsed.options.json ? printJson(records) : printRecords(records);
      break;
    }
    case "status": {
      const status = await getIntakeStatus(MODULE_ROOT);
      printJson(status);
      break;
    }
    case "authorize":
      await runAuthorize(positionals, parsed.options);
      break;
    case "help":
      help();
      break;
    default:
      help();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "FAILED",
    error: error.name,
    code: error.code ?? "UNEXPECTED_ERROR",
    message: error.message,
    details: error.details ?? null,
  }, null, 2));
  process.exitCode = 1;
});
