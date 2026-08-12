# Sovereign Foundry Bridge: Cybercore Opportunity Intelligence

**Version:** 1.0.0

**Authorization policy:** `human_required`

**Author:** Manus AI

This package is the executable **Sovereign OS compatibility bridge** for the canonical Cybercore Opportunity Intelligence Pipeline. The dedicated [`shalominattii-us/Foundry`](https://github.com/shalominattii-us/Foundry) repository owns the native Python intelligence plugins, maturity output engine, schemas, immutable run artifacts, and `foundry-cybercore` command.[1] This bridge retains the Sovereign-specific Node composition, Kernel event publication, replay projection, developer registry, and optional internal stream integration without copying or replacing Cybercore domain logic.[2]

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

The central developer registry exposes this compatibility composition as `foundry.cybercore-opportunity-intelligence` and lists all five hook names.[3]

## Plugin chain

| Plugin ID | Stage | Input | Output |
|---|---|---|---|
| `foundry.cybercore.discovery` | Discovery | Approved intake batch | Canonical discovered records and append-only events |
| `foundry.cybercore.source-verification` | Source verification | Authoritative evidence batch | Evidence-bound records and temporal status |
| `foundry.cybercore.strategic-intelligence` | Strategic intelligence | Strictly verified records and scoring policy | Explainable five-dimension scores |
| `foundry.cybercore.commercialization` | Commercialization routing | Verified, scored records and route policy | Candidate commercial paths and human-review boundaries |
| `foundry.cybercore.output` | Output engine | Final canonical records | Maturity bundles, aggregate index, and run manifest |

Each plugin result is hashed and embedded in the Foundry run manifest. A plugin failure stops the remaining chain and writes failure evidence without claiming completion.

## Canonical Foundry runtime

Run the native four-plugin pipeline in the dedicated Foundry repository:

```bash
foundry-cybercore \
  --batch examples/cybercore/2026-08-06/AEGENTIX-CYBERCORE-OPP-INTAKE-2026-08-06.json \
  --evidence examples/cybercore/2026-08-06/source-verification-2026-08-06.json \
  --output-root var/opportunities/cybercore-runs \
  --evaluated-at 2026-08-06T17:32:17Z
```

The Sovereign manifest’s `canonical_runtime` object identifies the actual repository, merged release branch, pinned commit, manifest, command, and local bridge role.

## Compatibility bridge quick start

The bridge requires Node.js 20 or newer and has no third-party runtime dependencies.

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
  --output-dir FOUNDRY/opportunity-intelligence/outputs \
  --evaluated-at 2026-08-06T17:32:17Z
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

`--evaluated-at` sets one ISO 8601 temporal reference for verification, scoring, routing, and maturity decisions. Omit it for a live wall-clock evaluation.

The stream adapter sends only aggregate counts and hashes to `foundry.opportunity-intelligence.output`; it does not publish full record snapshots or execute business actions. HTTPS is required except for localhost.

## Maturity model

The complete stage precedence and reassessment semantics are defined in the dedicated Opportunity Maturity Model.[5]

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

The schemas are published under `schemas/`, and the manifest links all canonical input, output, run, policy, documentation, and external Foundry runtime contracts.[4]

## Verification

```bash
npm test --prefix FOUNDRY/opportunity-intelligence
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix KERNEL/event-bus
```

The complete bridge test, schema, live-Kernel, output, replay, registry, CLI, and safety evidence is recorded in [`VERIFICATION.md`](VERIFICATION.md).[6]

## Documents and ownership

The canonical domain specification remains with Cybercore at `CYBERCORE/opportunity_intake/docs/INTELLIGENCE_PIPELINE_SPEC_v2.md`. The dedicated Foundry repository owns the native execution composition and output engine. This local package owns only the Sovereign compatibility and Kernel bridge. The split prevents either repository from becoming an undocumented duplicate of the other.

## References

[1]: https://github.com/shalominattii-us/Foundry/tree/12d59571c12cc38dbe723549d119f48db2f269d0 "Canonical Foundry Cybercore Opportunity Intelligence release commit"
[2]: ../../CYBERCORE/opportunity_intake/docs/INTELLIGENCE_PIPELINE_SPEC_v2.md "Cybercore Opportunity Intelligence Pipeline specification"
[3]: ../../DEVELOPER/plugin-registry/registry.js "AEGENTIS plugin registry"
[4]: manifests/cybercore-opportunity-intelligence.plugin.json "Sovereign Foundry bridge manifest"
[5]: docs/OPPORTUNITY_MATURITY_MODEL.md "Cybercore Opportunity Maturity Model"
[6]: VERIFICATION.md "Sovereign Foundry bridge verification evidence"
