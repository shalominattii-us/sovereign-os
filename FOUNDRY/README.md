# AEGENTIX Foundry

**Status:** Active

**Author:** Manus AI

Foundry is the repository-native composition layer for turning division capabilities into executable, versioned plugin pipelines with machine-readable inputs, deterministic outputs, and explicit safety boundaries. The first registered composition is the **Cybercore Opportunity Intelligence Pipeline**, located at [`FOUNDRY/opportunity-intelligence`](opportunity-intelligence).[1]

> Foundry composes existing production modules; it does not bypass their policy engines, event logs, state projectors, or human authorization controls.

## Architecture

| Layer | Repository component | Responsibility |
|---|---|---|
| Registry | [`DEVELOPER/plugin-registry`](../DEVELOPER/plugin-registry/registry.js) | Discovers the Foundry composition, hooks, entrypoint, manifest, and capabilities |
| Plugin runtime | [`opportunity-intelligence/src/plugins`](opportunity-intelligence/src/plugins) | Executes discovery, evidence verification, scoring, routing, and output stages |
| Source engine | [`CYBERCORE/opportunity_intake`](../CYBERCORE/opportunity_intake) | Owns canonical OpportunityRecords, events, policies, authorization, and lifecycle state |
| Kernel boundary | [`KERNEL/event-bus`](../KERNEL/event-bus) | Validates, persists, projects, and replay-reconstructs Cybercore events |
| Output engine | [`opportunity-intelligence/src/output_engine.js`](opportunity-intelligence/src/output_engine.js) | Produces immutable maturity bundles and an aggregate decision-support index |
| Optional stream adapter | [`opportunity-intelligence/src/adapters/event_stream.js`](opportunity-intelligence/src/adapters/event_stream.js) | Publishes aggregate output metadata to the internal event stream only when explicitly configured |

## Registered composition

The canonical plugin manifest is [`cybercore-opportunity-intelligence.plugin.json`](opportunity-intelligence/manifests/cybercore-opportunity-intelligence.plugin.json).[2] It registers five ordered hooks:

| Order | Hook | Executable stage |
|---:|---|---|
| 1 | `foundry.opportunity.discover` | Normalize, deduplicate, persist, and event-source the intake batch |
| 2 | `foundry.opportunity.verify-source` | Apply authoritative evidence and temporal classification |
| 3 | `foundry.opportunity.score` | Compute versioned five-dimension strategic intelligence |
| 4 | `foundry.opportunity.route` | Identify commercial paths and stop actionable records at human review |
| 5 | `foundry.opportunity.emit-output` | Emit maturity bundles, an aggregate index, and a hashed run manifest |

## Operation

Run the composition directly:

```bash
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run
```

Or use the repository-wide CLI:

```bash
node DEVELOPER/cli/aegentis.js foundry run
```

Generated outputs remain local and are ignored by Git under `FOUNDRY/opportunity-intelligence/outputs/`. The source evidence, policies, schemas, canonical documentation, and tests remain tracked.

## Safety boundary

Foundry produces internal decision-support artifacts. It records **zero automatic dispatches**, **zero external actions**, and **zero Treasury Labs handoffs**. A record ready for action stops at `HUMAN_REVIEW_REQUIRED`; a downstream executor must independently verify the scoped Cybercore authorization artifact before performing the approved external action.[3]

## References

[1]: opportunity-intelligence/README.md "Foundry Opportunity Intelligence operator guide"
[2]: opportunity-intelligence/manifests/cybercore-opportunity-intelligence.plugin.json "Foundry plugin manifest"
[3]: ../CYBERCORE/opportunity_intake/docs/INTELLIGENCE_PIPELINE_SPEC_v2.md "Cybercore Opportunity Intelligence Pipeline specification"
