# AEGENTIX Foundry Bridge

**Status:** Active compatibility bridge
**Author:** Manus AI

The canonical **Foundry execution platform and Cybercore Opportunity Intelligence Pipeline** live in the dedicated [`shalominattii-us/Foundry`](https://github.com/shalominattii-us/Foundry) repository.[1] The `FOUNDRY/` directory in `sovereign-os` is the Sovereign OS compatibility layer: it adapts Cybercore records and Kernel events to local maturity projections while preserving the same human-authorization boundary.

> **Ownership boundary:** Foundry owns its Python plugin runtime and immutable output engine. Sovereign OS owns the Cybercore domain contract, Kernel event integration, policy enforcement, and the local compatibility adapter.

## Architecture

| Layer | Canonical component | Responsibility |
|---|---|---|
| Foundry runtime | [`shalominattii-us/Foundry`](https://github.com/shalominattii-us/Foundry) | Four-stage intelligence plugin chain, maturity classification, immutable run artifacts, and native operator CLI |
| Sovereign bridge | [`FOUNDRY/opportunity-intelligence`](opportunity-intelligence) | Backward-compatible Node composition, Kernel publication, local maturity index, and AEGENTIS CLI delegation |
| Source engine | [`CYBERCORE/opportunity_intake`](../CYBERCORE/opportunity_intake) | Canonical OpportunityRecords, evidence, scores, routes, authorization, and lifecycle events |
| Kernel boundary | [`KERNEL/event-bus`](../KERNEL/event-bus) | Policy validation, persistence, projection, replay, and side-effect isolation |
| Registry | [`DEVELOPER/plugin-registry`](../DEVELOPER/plugin-registry/registry.js) | Discovers the Sovereign compatibility composition and its capabilities |
| Optional internal stream | [`CLOUD/event-streaming`](../CLOUD/event-streaming) | Publishes aggregate metadata only when explicitly configured |

## Canonical Foundry operation

In the dedicated Foundry repository, run the versioned Cybercore batch and evidence with:

```bash
foundry-cybercore \
  --batch examples/cybercore/2026-08-06/AEGENTIX-CYBERCORE-OPP-INTAKE-2026-08-06.json \
  --evidence examples/cybercore/2026-08-06/source-verification-2026-08-06.json \
  --output-root var/opportunities/cybercore-runs \
  --evaluated-at 2026-08-06T17:32:17Z
```

The canonical Foundry manifest is `manifests/cybercore-opportunity-intelligence.json`. The Sovereign compatibility manifest pins the merged repository commit, release branch, canonical manifest path, and native command.

## Sovereign compatibility operation

Run the local bridge directly:

```bash
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run
```

Or use the repository-wide AEGENTIS CLI:

```bash
node DEVELOPER/cli/aegentis.js foundry run
```

The compatibility bridge remains fully tested because it exercises Sovereign OS-specific Kernel publication, event projection, replay isolation, and local aggregate-stream behavior that do not belong in the standalone Foundry runtime.[2]

## Safety boundary

Both runtimes produce decision-support artifacts only. They record **zero automatic dispatches**, **zero external actions**, and **zero Treasury Labs handoffs**. An actionable record stops at human review; downstream execution must independently verify a scoped authorization artifact before performing any approved external action.[3]

## References

[1]: https://github.com/shalominattii-us/Foundry/tree/12d59571c12cc38dbe723549d119f48db2f269d0 "Canonical Foundry Cybercore Opportunity Intelligence release commit"
[2]: opportunity-intelligence/VERIFICATION.md "Sovereign Foundry bridge verification evidence"
[3]: ../CYBERCORE/opportunity_intake/docs/INTELLIGENCE_PIPELINE_SPEC_v2.md "Cybercore Opportunity Intelligence Pipeline specification"
