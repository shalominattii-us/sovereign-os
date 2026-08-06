# AEGENTIX Cybercore Opportunity Intake

**Version:** 1.0.0

**Authorization policy:** `human_required`

**Operating invariant:** Event first. State second. No external action without authorization.

This module converts opportunity intelligence into deterministic, deduplicated, replayable `OpportunityRecord` artifacts. It supports funding and procurement routes, amendment merging, strategic priority queues, append-only audit events, optional publication to the Sovereign OS Kernel, and scoped human authorization records.

> The bundled 2026-08-06 intake contains only information present in the supplied directive. Missing identifiers, deadlines, funding values, eligibility rules, and authoritative URLs remain explicitly null or empty. Records do not advance from `DISCOVERED` until the required source-verification fields are supplied.

## Architecture

```text
incoming/
    ↓ structural validation
normalizer + deterministic identity
    ↓ issuer + identifier + title_hash + deadline
merge / deduplication
    ↓ source verification
strategic classification and priority routing
    ↓
HUMAN_REVIEW_REQUIRED
    ↓ explicit human authorization artifact
AUTHORIZED_ACTION
```

The pipeline writes a local append-only event log under `events/`. When `--kernel-url` is provided, the same events are sent to the Kernel’s `cybercore` domain and projected into the global world state. Kernel replay only reconstructs state; it does not dispatch opportunity side effects.

## Workflow directories

| Directory | Purpose | Version-control policy |
|---|---|---|
| `incoming/` | Source batches approved for intake | Tracked |
| `normalized/` | Canonical `OpportunityRecord` files | Generated locally |
| `validated/` | Records with issuer, identifier, HTTPS source, and source-check timestamp | Generated locally |
| `strategic_queue/` | Strategically matched records | Generated locally |
| `commercial_pipeline/` | Records with an identified revenue path | Generated locally |
| `archive/` | Cancelled or awarded records retained for audit | Generated locally |
| `events/` | Append-only JSONL domain events | Generated locally |
| `authorizations/` | Scoped human authorization artifacts | Generated locally |
| `runs/` | Hashed success or failure manifests | Generated locally |

## Quick start

The module has no third-party runtime dependencies and requires Node.js 20 or newer.

```bash
cd CYBERCORE/opportunity_intake
npm test
npm link
```

Run the supplied intake exactly as directed:

```bash
aegentix_cybercore_ingest \
  --source opportunity_intake \
  --batch 2026-08-06 \
  --mode normalize_validate \
  --authorization human_required
```

The command defaults to `incoming/AEGENTIX-CYBERCORE-OPP-INTAKE-2026-08-06.json`. It never submits, registers, bids, contracts, commits funds, or communicates externally.

## Kernel publication

Start the Kernel, then provide its intent endpoint to the command:

```bash
aegentix_cybercore_ingest \
  --batch 2026-08-06 \
  --kernel-url http://localhost:8080/intent \
  --kernel-required
```

Without `--kernel-required`, a temporarily unavailable Kernel is reported in the run manifest while the durable local intake still completes. With `--kernel-required`, publication failure causes the run to fail closed.

## Review operations

Use the built-in inspection commands to view records without mutating them.

```bash
aegentix_cybercore_ingest status
aegentix_cybercore_ingest list
aegentix_cybercore_ingest list --priority P0
aegentix_cybercore_ingest list --state DISCOVERED --json
```

The initial directive produces **22 normalized records**. Because the directive did not include authoritative source URLs, identifiers, or verification timestamps for most records, the first run correctly retains them in `DISCOVERED` with `NEEDS_SOURCE_VERIFICATION` rather than claiming that the opportunities are active or eligible.

## Source verification and amendment ingestion

To advance a record, ingest an updated record containing the authoritative issuer, identifier, HTTPS source URL, and `source_checked_at` timestamp. The deduplication engine first matches exact deterministic keys and then uses normalized `issuer + identifier` to merge deadline extensions, amendments, cancellations, awards, and forecast-to-active changes. Stable record identity is preserved, while changed keys are retained in `deduplication_aliases` for auditability.

A verified, strategically classified record with a revenue path and priority advances through the internal lifecycle to `HUMAN_REVIEW_REQUIRED`. These transitions only organize internal state and do not authorize an external act.

## Human authorization

A human may record one narrowly scoped authorization after reviewing a `HUMAN_REVIEW_REQUIRED` record:

```bash
aegentix_cybercore_ingest authorize opp_0123456789abcdef01234567 \
  --action bid \
  --authorized-by human:reviewer-001 \
  --reason "Compliance review completed; bid preparation approved" \
  --ticket-reference DECISION-2026-001 \
  --expires-at 2026-08-07T18:00:00.000Z
```

| Control | Enforcement |
|---|---|
| Human identity | `authorized_by` must use `human:<identifier>` |
| Scope | One of `submission`, `registration`, `bid`, `contract`, `financial_commitment`, or `external_communication` |
| Integrity | Artifact and reviewed record snapshot are SHA-256 bound |
| Expiry | Defaults to 24 hours and must be in the future |
| State | Only `HUMAN_REVIEW_REQUIRED` can advance to `AUTHORIZED_ACTION` |
| Execution | The command records authorization only; it never executes the external action |

Any downstream executor must call `assertAuthorizedExternalAction(record, artifact, action)` before acting. That guard rejects missing, tampered, expired, or out-of-scope authorizations.

## Record schema

The machine-readable contract is available at `schema/opportunity-record.schema.json`. Canonical records include source provenance, funding or procurement classification, routing, strategic fit, revenue path, validation evidence, lifecycle history, state history, and authorization controls.

The deterministic deduplication key is:

```text
normalized_issuer + normalized_identifier + title_hash + normalized_deadline
```

The identifier is `opp_` followed by the first 24 hexadecimal characters of the SHA-256 digest of that key.

## Verification

Run both suites before deployment:

```bash
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix KERNEL/event-bus
```

A successful implementation reaches `TEST_VERIFIED`. Runtime verification can be performed by starting the Kernel, ingesting with `--kernel-required`, and confirming the `cybercore` slice at `GET /state`. The completed evidence for this implementation is recorded in [`VERIFICATION.md`](VERIFICATION.md).
