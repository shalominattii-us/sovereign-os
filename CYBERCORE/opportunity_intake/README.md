# AEGENTIX Cybercore Opportunity Intelligence Pipeline

**Version:** 2.0.0

**Authorization policy:** `human_required`

**Operating invariant:** Event first. State second. No external action without authorization.

This module converts opportunity intelligence into deterministic, deduplicated, replayable `OpportunityRecord` artifacts. Version 2 adds **authoritative source verification**, **five-dimension strategic intelligence scoring**, and **commercialization routing** while preserving a strict human boundary before any Treasury Labs handoff or external act.

> Discovery does not imply validation. Validation does not imply strategic fit. Strategic fit does not imply authorization. Authorization records a scoped human decision; it does not execute a submission, registration, bid, contract, financial commitment, or communication.

The implementation contract is defined in [`docs/INTELLIGENCE_PIPELINE_SPEC_v2.md`](docs/INTELLIGENCE_PIPELINE_SPEC_v2.md).[1]

## Architecture

```text
incoming opportunity batch
    ↓ structural validation + deterministic identity
DISCOVERED
    ↓ authoritative evidence batch
VALIDATED or retained in source discovery
    ↓ versioned deterministic five-dimension policy
STRATEGIC_MATCHED
    ↓ versioned commercialization route policy
HUMAN_REVIEW_REQUIRED, monitor-only, closed, or discovery-only
    ↓ explicit scoped human authorization artifact
AUTHORIZED_ACTION
```

Every layer appends a domain event and persists the complete updated record snapshot. Optional Kernel publication projects the same snapshots into the `cybercore` world-state slice. Replay reconstructs state without dispatching opportunity side effects.

## Workflow directories

| Directory | Purpose | Version-control policy |
|---|---|---|
| `incoming/` | Approved discovery batches | Tracked |
| `evidence/` | Authoritative source-evidence batches | Tracked |
| `policy/` | Versioned scoring and commercialization policies | Tracked |
| `schema/` | Intake, evidence, and OpportunityRecord JSON Schemas | Tracked |
| `normalized/` | Canonical v2 records | Generated locally |
| `validated/` | Strictly verified records | Generated locally |
| `strategic_queue/` | Verified and scored records | Generated locally |
| `commercial_pipeline/` | Open, actionable records awaiting human review | Generated locally |
| `archive/` | Closed, historical, cancelled, or awarded records | Generated locally |
| `events/` | Append-only JSONL domain events | Generated locally |
| `authorizations/` | Scoped human authorization artifacts | Generated locally |
| `runs/` | Hashed success and failure manifests | Generated locally |
| `research/` | Source-research audit notes | Tracked |

## Quick start

The module has no third-party runtime dependencies and requires Node.js 20 or newer.

```bash
cd CYBERCORE/opportunity_intake
npm test
npm link
```

First ingest the bundled discovery batch:

```bash
aegentix_cybercore_ingest ingest \
  --source opportunity_intake \
  --batch 2026-08-06 \
  --mode normalize_validate \
  --authorization human_required
```

Then execute all three intelligence layers:

```bash
aegentix_cybercore_ingest pipeline
```

The one-command pipeline is equivalent to:

```bash
aegentix_cybercore_ingest verify \
  --evidence evidence/source-verification-2026-08-06.json

aegentix_cybercore_ingest score \
  --record all \
  --policy policy/intelligence-policy-v1.json

aegentix_cybercore_ingest route \
  --record all \
  --commercialization-policy policy/commercialization-policy-v1.json
```

Each operation writes a hashed run manifest. A source-evidence refresh resets downstream scores, routes, and any stale authorization so the updated record must pass the pipeline again.

## Acceptance snapshot for the bundled batch

The bundled evidence batch records the authoritative pages and retrieval timestamp for all 22 intake titles.[2] The acceptance run on 2026-08-06 produced these deterministic results:

| Outcome | Count |
|---|---:|
| Normalized records | 22 |
| Strictly verified specific opportunities | 13 |
| Retained for further source verification | 9 |
| Open | 3 |
| Deadline on evaluation date | 2 |
| Closed or historical | 7 |
| Forecast | 1 |
| Program/category only | 6 |
| Unknown exact match | 3 |
| Scored | 13 |
| Ready for explicit human review | 5 |
| Treasury Labs handoffs executed | **0** |

The five records routed to `HUMAN_REVIEW_REQUIRED` are NSF AI Infrastructure Hubs, NSF E-RISE, DOE ARPA-E HORNIG, Promise Neighborhoods, and the verified HUD Fair Housing Education and Outreach opportunity. A `DEADLINE_TODAY` classification does not assert that the submission cutoff time remains available; it requires expedited human confirmation.

## Source verification

Strict `VERIFIED` status requires all of the following:

| Requirement | Enforcement |
|---|---|
| Authoritative source | At least one HTTPS URL and named source authority |
| Retrieval provenance | ISO 8601 UTC timestamp |
| Issuer | Present and marked directly verified |
| Identifier | Present and marked directly verified |
| Deadline | Present and marked directly verified |
| Specificity | Specific active, forecast, or historical opportunity rather than a broad category |

Program portfolios and broad procurement channels retain useful evidence, but remain `NEEDS_SOURCE_VERIFICATION` until a specific child solicitation is identified. No-match records remain in source discovery.

## Strategic intelligence

The intelligence policy computes five 0–100 dimensions: `sector_fit`, `revenue_probability`, `funding_probability`, `implementation_complexity`, and `strategic_alignment`. The weighted score is:

```text
sector_fit × 0.25
+ revenue_probability × 0.20
+ funding_probability × 0.20
+ (100 - implementation_complexity) × 0.15
+ strategic_alignment × 0.20
```

The calculation is an **explainable deterministic heuristic**, not a statistically calibrated prediction. Every score stores its policy version, weights, input signals, dimensions, and explanation. Unknown sectors receive a documented default rather than an invented record-specific value.

## Commercialization routing

The route policy can identify these internal candidate paths:

| Path | Typical signal |
|---|---|
| `grant` | Grant or cooperative agreement |
| `research_partnership` | Consortium, partnership, or research delivery |
| `prime_bid` | Standard procurement |
| `subcontractor_position` | Explicit subcontractor market entry |
| `prototype_demonstration` | CSO, challenge, accelerator, or prototype |
| `licensing_commercialization` | Technology need or commercialization program |
| `supplier_contract` | Supplier or vendor channel |
| `consulting_engagement` | Consulting, advisory, or assessment work |

Only a strictly verified, scored, open record can become `READY_FOR_HUMAN_REVIEW`. Forecasts are monitor-only, closed records are no-action, program categories remain discovery-only, and incomplete records remain source-verification work. The Treasury Labs handoff object is `HUMAN_APPROVAL_REQUIRED` only for ready records and `BLOCKED` otherwise. `automatic_dispatch` is always `false`.

## Human authorization

A human may record one narrowly scoped authorization after reviewing a `HUMAN_REVIEW_REQUIRED` record:

```bash
aegentix_cybercore_ingest authorize opp_0123456789abcdef01234567 \
  --action bid \
  --authorized-by human:reviewer-001 \
  --reason "Evidence, score, route, and compliance reviewed; bid preparation approved" \
  --ticket-reference DECISION-2026-001 \
  --expires-at 2026-08-07T18:00:00.000Z
```

| Control | Enforcement |
|---|---|
| Human identity | `authorized_by` must use `human:<identifier>` |
| Scope | One enumerated external action |
| Integrity | Artifact and complete reviewed v2 snapshot are SHA-256 bound |
| Expiry | Defaults to 24 hours and must be in the future |
| State | Only `HUMAN_REVIEW_REQUIRED` can advance to `AUTHORIZED_ACTION` |
| Evidence change | Revokes authorization and resets score and route |
| Execution | Authorization is recorded only; no external action is executed |

Any downstream executor must call `assertAuthorizedExternalAction(record, artifact, action)`. The guard rejects missing, tampered, expired, stale, or out-of-scope authorization.

## Kernel publication

Provide the Kernel intent endpoint to any ingest or pipeline command:

```bash
aegentix_cybercore_ingest pipeline \
  --kernel-url http://localhost:8080/intent \
  --kernel-required
```

Without `--kernel-required`, unavailable Kernel publication is recorded while local durable processing completes. With it, publication fails closed. The Kernel validates evidence, score, route, human-gate, and zero-automatic-handoff invariants before projection.

## Inspection and verification

```bash
aegentix_cybercore_ingest status --json
aegentix_cybercore_ingest list --state HUMAN_REVIEW_REQUIRED --json
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix KERNEL/event-bus
```

The complete reproducible acceptance evidence is recorded in [`VERIFICATION.md`](VERIFICATION.md).[3]

## References

[1]: docs/INTELLIGENCE_PIPELINE_SPEC_v2.md "Cybercore Intelligence Pipeline Specification v2"
[2]: evidence/source-verification-2026-08-06.json "Authoritative source-evidence batch"
[3]: VERIFICATION.md "Cybercore verification evidence"
