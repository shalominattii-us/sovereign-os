# Cybercore Opportunity Maturity Model

**Version:** 1.0.0

**Status:** Active

**Author:** Manus AI

The Opportunity Maturity Model is Foundry’s read-only interpretation of final Cybercore state. It provides a consistent decision-support vocabulary for output bundles without changing the underlying `OpportunityRecord`, lifecycle, evidence, score, route, or authorization semantics.[1]

> Maturity is not authorization. A higher maturity stage does not permit Foundry to execute an external action.

## Stage model

| Stage | Order | Entry condition | Expected next decision |
|---|---:|---|---|
| `DISCOVERED` | 10 | Canonical record exists but no stronger evidence state applies | Continue internal normalization and research |
| `SOURCE_DISCOVERY` | 20 | Strict source verification is incomplete | Find a specific authoritative issuer, identifier, and deadline |
| `SOURCE_VERIFIED` | 30 | Strict verification passes but scoring is incomplete | Apply versioned strategic intelligence policy |
| `STRATEGIC_INTELLIGENCE` | 40 | Verified record has an explainable score but no final route | Apply commercialization policy |
| `FORECAST_MONITOR` | 45 | Verified record is a forecast | Monitor for an active child opportunity |
| `PROGRAM_DISCOVERY` | 45 | Evidence identifies a program/category rather than one solicitation | Discover a specific child opportunity |
| `HUMAN_REVIEW` | 50 | Record is verified, scored, routed, and currently actionable | Obtain an explicit human decision |
| `AUTHORIZED_SCOPE_RECORDED` | 60 | Cybercore records a scoped human authorization | A separate executor must reverify artifact, scope, integrity, and expiry |
| `CLOSED` | 90 | Deadline passed or a terminal state applies | Retain for history and learning; no current action |

The model branches rather than advancing monotonically. Forecast, program-only, source-discovery, and closed records do not pass through `HUMAN_REVIEW` merely because earlier analytical work exists.

## State mapping

Foundry evaluates the most specific Cybercore state in this precedence order:

| Precedence | Cybercore signal | Foundry maturity |
|---:|---|---|
| 1 | `action_state == AUTHORIZED_ACTION` | `AUTHORIZED_SCOPE_RECORDED` |
| 2 | `commercialization.status == READY_FOR_HUMAN_REVIEW` | `HUMAN_REVIEW` |
| 3 | `commercialization.status == CLOSED_NO_ACTION` | `CLOSED` |
| 4 | `commercialization.status == MONITOR_FORECAST` | `FORECAST_MONITOR` |
| 5 | `commercialization.status == PROGRAM_DISCOVERY_ONLY` | `PROGRAM_DISCOVERY` |
| 6 | `commercialization.status == SOURCE_VERIFICATION_REQUIRED` | `SOURCE_DISCOVERY` |
| 7 | `intelligence.status == SCORED` | `STRATEGIC_INTELLIGENCE` |
| 8 | `validation.status == VERIFIED` | `SOURCE_VERIFIED` |
| 9 | `validation.status == NEEDS_SOURCE_VERIFICATION` | `SOURCE_DISCOVERY` |
| 10 | Otherwise | `DISCOVERED` |

This precedence is implemented in the Foundry output engine and tested against real pipeline records.[2]

## Reassessment behavior

A material source-evidence change resets downstream intelligence and commercialization state in Cybercore and invalidates stale authorization. The next Foundry run therefore emits the lower, correct maturity stage rather than preserving a stale higher stage. Foundry never maintains an independent maturity database; every bundle is recomputed from the canonical record snapshot.

## Output decision mapping

| Maturity | Disposition | Human decision | Actionable now |
|---|---|---:|---:|
| `SOURCE_DISCOVERY` | `REQUIRES_AUTHORITATIVE_SOURCE_EVIDENCE` | No | No |
| `PROGRAM_DISCOVERY` | `DISCOVER_SPECIFIC_CHILD_OPPORTUNITY` | No | No |
| `FORECAST_MONITOR` | `MONITOR_FORECAST` | No | No |
| `HUMAN_REVIEW` | `REQUIRES_HUMAN_DECISION` | Yes | Yes, only after approval |
| `AUTHORIZED_SCOPE_RECORDED` | `DOWNSTREAM_EXECUTOR_MUST_REVERIFY_AUTHORIZATION` | Already recorded | Foundry still does not execute |
| `CLOSED` | `NO_ACTION_HISTORICAL` | No | No |
| Other internal stages | `CONTINUE_INTERNAL_PIPELINE` | No | No |

## Invariants

Every maturity bundle is bound to the canonical record by SHA-256 hash and includes `external_action_executed: false`, `output_is_decision_support_only: true`, and `authorization_required_for_external_action: true`. Treasury Labs fields always record `automatic_dispatch: false` and `handoff_executed: false`. The aggregate index always reports zero automatic dispatches and zero external actions.[3]

## References

[1]: ../../../CYBERCORE/opportunity_intake/schema/opportunity-record.schema.json "OpportunityRecord v2 schema"
[2]: ../src/output_engine.js "Foundry opportunity maturity output engine"
[3]: ../schemas/opportunity-maturity-output.schema.json "Foundry opportunity maturity output schema"
