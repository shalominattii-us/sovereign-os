# Foundry: Cybercore Opportunity Intelligence

**Version:** 1.0.0

**Authorization policy:** `human_required`

**Author:** Manus AI

This package is the executable Foundry composition for the canonical Cybercore Opportunity Intelligence Pipeline. It does not copy or replace Cybercore logic. Instead, five versioned plugins invoke the production intake, evidence, scoring, and routing operations in order, then convert final `OpportunityRecord` snapshots into deterministic **opportunity-maturity outputs**.[1]

> A Foundry output is decision support, not permission to act. No plugin submits, registers, bids, contracts, commits funds, communicates externally, or hands a record to Treasury Labs automatically.

## Component map

| Component | Purpose |
|---|---|
| `manifests/` | Canonical plugin composition and safety metadata |
| `src/plugins/` | Five executable stage adapters |
| `src/output_engine.js` | Immutable maturity-bundle and aggregate-index generator |
| `src/adapters/event_stream.js` | Optional internal aggregate-metadata publisher |
| `schemas/` | Plugin, run, bundle, and index contracts |
| `outputs/` | Generated local bundles and run evidence; ignored by Git |
| `docs/FOUNDRY_INTEGRATION.md` | Architecture and integration contract |
| `docs/OPPORTUNITY_MATURITY_MODEL.md` | Maturity stages, precedence, dispositions, and safety meaning |
| `tests/` | Unit, registry, stream, and full-pipeline integration coverage |

The central developer registry exposes this composition as `foundry.cybercore-opportunity-intelligence` and lists all five hook names.[2]

## Plugin chain

| Plugin ID | Stage | Input | Output |
|---|---|---|---|
| `foundry.cybercore.discovery` | Discovery | Approved intake batch | Canonical discovered records and append-only events |
| `foundry.cybercore.source-verification` | Source verification | Authoritative evidence batch | Evidence-bound records and temporal status |
| `foundry.cybercore.strategic-intelligence` | Strategic intelligence | Strictly verified records and scoring policy | Explainable five-dimension scores |
| `foundry.cybercore.commercialization` | Commercialization routing | Verified, scored records and route policy | Candidate commercial paths and human-review boundaries |
| `foundry.cybercore.output` | Output engine | Final canonical records | Maturity bundles, aggregate index, and run manifest |

Each plugin result is hashed and embedded in the Foundry run manifest. A plugin failure stops the remaining chain and writes failure evidence without claiming completion.

## Quick start

The package requires Node.js 20 or newer and has no third-party runtime dependencies.

```bash
npm test --prefix FOUNDRY/opportunity-intelligence
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js manifest
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js plugins
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run
```

The repository-wide command delegates to the same entrypoint:

```bash
node DEVELOPER/cli/aegentis.js foundry run
```

## Explicit paths and services

```bash
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run \
  --base-dir CYBERCORE/opportunity_intake \
  --input CYBERCORE/opportunity_intake/incoming/AEGENTIX-CYBERCORE-OPP-INTAKE-2026-08-06.json \
  --evidence CYBERCORE/opportunity_intake/evidence/source-verification-2026-08-06.json \
  --intelligence-policy CYBERCORE/opportunity_intake/policy/intelligence-policy-v1.json \
  --commercialization-policy CYBERCORE/opportunity_intake/policy/commercialization-policy-v1.json \
  --output-dir FOUNDRY/opportunity-intelligence/outputs
```

To require Kernel publication for all Cybercore events:

```bash
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run \
  --kernel-url http://localhost:8080/intent \
  --kernel-required
```

To publish the aggregate output index to the internal event stream:

```bash
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run \
  --stream-url http://localhost:8084 \
  --stream-required
```

The stream adapter sends only aggregate counts and hashes to `foundry.opportunity-intelligence.output`; it does not publish full record snapshots or execute business actions. HTTPS is required except for localhost.

## Maturity model

The complete stage precedence and reassessment semantics are defined in the dedicated Opportunity Maturity Model.[4]

| Stage | Meaning | Actionability |
|---|---|---|
| `DISCOVERED` | Canonical intake exists | Internal processing only |
| `SOURCE_DISCOVERY` | Specific authoritative evidence remains incomplete | Research required |
| `SOURCE_VERIFIED` | Source, issuer, identifier, and deadline satisfy strict verification | Scoring required |
| `STRATEGIC_INTELLIGENCE` | Versioned strategic score exists | Routing required |
| `FORECAST_MONITOR` | Verified forecast, not open | Monitor only |
| `PROGRAM_DISCOVERY` | Program/category evidence exists without one actionable child solicitation | Discover a child record |
| `HUMAN_REVIEW` | Open, verified, scored, and routed | Explicit human decision required |
| `AUTHORIZED_SCOPE_RECORDED` | Cybercore recorded a scoped human authorization | Downstream executor must reverify artifact, scope, and expiry |
| `CLOSED` | Deadline passed or terminal status applies | Historical/no action |

## Output contract

Each `<record_id>.maturity.json` file contains the canonical record hash, maturity decision, compact summary, Treasury Labs block, explicit safety state, full record snapshot, and artifact hash. `index.json` inventories every bundle and aggregates maturity and disposition counts.

| Invariant | Enforced value |
|---|---|
| `automatic_dispatches` | `0` |
| `external_actions_executed` | `0` |
| `treasury_labs.automatic_dispatch` | `false` |
| `treasury_labs.handoff_executed` | `false` |
| Ready record | Stops at `HUMAN_REVIEW` |
| Output role | `output_is_decision_support_only: true` |

The schemas are published under `schemas/`, and the manifest links all canonical input, output, run, policy, and documentation contracts.[3]

## Verification

```bash
npm test --prefix FOUNDRY/opportunity-intelligence
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix KERNEL/event-bus
```

The complete test, schema, live-Kernel, output, replay, registry, CLI, and safety evidence is recorded in [`VERIFICATION.md`](VERIFICATION.md).[5]

## Documents and ownership

The canonical pipeline specification remains with the domain owner at `CYBERCORE/opportunity_intake/docs/INTELLIGENCE_PIPELINE_SPEC_v2.md`. Foundry references that document from its manifest and adds only the composition, plugin, output, and operator contract. This preserves one authoritative source rather than introducing a divergent copy.

## References

[1]: ../../CYBERCORE/opportunity_intake/docs/INTELLIGENCE_PIPELINE_SPEC_v2.md "Cybercore Opportunity Intelligence Pipeline specification"
[2]: ../../DEVELOPER/plugin-registry/registry.js "AEGENTIS plugin registry"
[3]: manifests/cybercore-opportunity-intelligence.plugin.json "Foundry plugin manifest"
[4]: docs/OPPORTUNITY_MATURITY_MODEL.md "Cybercore Opportunity Maturity Model"
[5]: VERIFICATION.md "Foundry integration verification evidence"
