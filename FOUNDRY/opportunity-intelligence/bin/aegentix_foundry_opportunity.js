#!/usr/bin/env node

import path from "node:path";

import {
  FOUNDRY_PLUGINS,
  loadFoundryManifest,
  runFoundryOpportunityPipeline,
} from "../src/foundry.js";
import { DEFAULT_PATHS } from "../src/paths.js";

function optionName(value) {
  return value.replace(/^--/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function parseArguments(values) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const [rawName, inlineValue] = value.split(/=(.*)/s, 2);
    const name = optionName(rawName);
    if (inlineValue !== undefined) {
      options[name] = inlineValue;
    } else if (values[index + 1] && !values[index + 1].startsWith("--")) {
      options[name] = values[index + 1];
      index += 1;
    } else {
      options[name] = true;
    }
  }
  return { positionals, options };
}

function help() {
  console.log(`
AEGENTIX Foundry — Cybercore Opportunity Intelligence

Usage:
  aegentix_foundry_opportunity run [options]
  aegentix_foundry_opportunity manifest
  aegentix_foundry_opportunity plugins

Run options:
  --base-dir <path>                    Cybercore runtime base directory
  --input <path>                       Approved opportunity intake batch
  --evidence <path>                    Authoritative source-evidence batch
  --intelligence-policy <path>         Strategic scoring policy
  --commercialization-policy <path>    Commercialization routing policy
  --output-dir <path>                  Foundry maturity output directory
  --batch <selector>                   Optional batch selector
  --kernel-url <url>                   Optional Kernel /intent endpoint
  --kernel-required                    Fail closed if Kernel publication fails
  --stream-url <url>                   Optional internal event-stream service
  --stream-required                    Fail closed if output-index publication fails

Safety:
  Foundry emits decision-support artifacts only. It performs no submission,
  registration, bid, contract, financial commitment, external communication,
  or Treasury Labs handoff.
`);
}

async function run(options) {
  const result = await runFoundryOpportunityPipeline({
    baseDir: path.resolve(options.baseDir ?? DEFAULT_PATHS.baseDir),
    inputFile: path.resolve(options.input ?? DEFAULT_PATHS.inputFile),
    evidenceFile: path.resolve(options.evidence ?? DEFAULT_PATHS.evidenceFile),
    intelligencePolicyFile: path.resolve(options.intelligencePolicy ?? DEFAULT_PATHS.intelligencePolicyFile),
    commercializationPolicyFile: path.resolve(options.commercializationPolicy ?? DEFAULT_PATHS.commercializationPolicyFile),
    outputDir: path.resolve(options.outputDir ?? DEFAULT_PATHS.outputDir),
    batchSelector: options.batch ?? null,
    kernelUrl: options.kernelUrl ?? null,
    kernelRequired: options.kernelRequired === true,
    streamUrl: options.streamUrl ?? null,
    streamRequired: options.streamRequired === true,
  });
  process.stdout.write(`${JSON.stringify({
    foundry_run_id: result.foundry_run_id,
    status: result.status,
    plugins_completed: result.plugin_results.length,
    output: result.output,
    stream_publication: result.stream_publication,
    safety: result.safety,
    artifact_hash: result.artifact_hash,
  }, null, 2)}\n`);
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  const command = parsed.positionals[0] ?? "run";
  switch (command) {
    case "run":
      await run(parsed.options);
      break;
    case "manifest":
      process.stdout.write(`${JSON.stringify(await loadFoundryManifest(), null, 2)}\n`);
      break;
    case "plugins":
      process.stdout.write(`${JSON.stringify(FOUNDRY_PLUGINS.map(({ execute, ...plugin }) => plugin), null, 2)}\n`);
      break;
    case "help":
    case "--help":
    case "-h":
      help();
      break;
    default:
      throw new Error(`Unknown Foundry command: ${command}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    status: "FAILED",
    error: {
      name: error.name,
      code: error.code ?? "UNEXPECTED_ERROR",
      message: error.message,
      details: error.details ?? null,
    },
  }, null, 2)}\n`);
  process.exitCode = 1;
});
