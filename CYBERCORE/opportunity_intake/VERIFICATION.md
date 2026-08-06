# Cybercore Opportunity Intelligence Pipeline Verification Evidence

**Module:** `CYBERCORE/opportunity_intake`

**Version:** 2.0.0

**Verification date:** 2026-08-06

**Author:** Manus AI

## Classification

The implementation reached **RUNTIME_VERIFIED** for repository-contained execution of authoritative source verification, deterministic strategic scoring, commercialization routing, and Kernel policy/projection behavior. It is **not** certified as a production deployment, and no external submission, registration, bid, contract, financial commitment, communication, or Treasury Labs handoff was executed.

| Verification stage | Result | Evidence |
|---|---|---|
| `SOURCE_PRESENT` | Pass | Source-verification, intelligence, commercialization, policies, schemas, evidence, CLI, tests, and documentation are present. |
| `BUILD_VERIFIED` | Pass | JavaScript syntax and JSON validation completed without errors. |
| `TEST_VERIFIED` | Pass | All Cybercore and Kernel suites passed. |
| `RUNTIME_VERIFIED` | Pass | The complete 22-record ingest, verify, score, and route workflow completed. |
| `KERNEL_LIVE_VERIFIED` | Pass | All 79 v2 events published with `--kernel-required` to an isolated live Kernel. |
| `REPLAY_VERIFIED` | Pass | Restart replay applied 79 events, skipped 0, and dispatched the router 0 times. |
| `DATA_QUALITY_VERIFIED` | Pass | Every intake title received an evidence decision; unverifiable categories remained nonverified. |
| `CONFIG_BOUND` | Pass | Policies are versioned files and Kernel publication is explicit with optional fail-closed behavior. |
| `EVIDENCE_PRODUCED` | Pass | Evidence batch, run manifests, append-only events, normalized records, and this report provide reproducible evidence. |
| `CERTIFICATION_ELIGIBLE` | Not asserted | Persistent production deployment, scheduled refresh, and operational authorization decisions remain outside this repository implementation. |

## Automated tests

| Suite | Result | Coverage summary |
|---|---|---|
| Cybercore module | **30 passed, 0 failed** | Strict evidence, temporal status, stable IDs, deduplication, enrichment, scoring formula, deterministic rescoring, route mapping, closed/forecast/program blocking, Treasury gate, authorization identity/scope/expiry/integrity, and end-to-end stage persistence. |
| Kernel event bus | **15 passed, 0 failed** | Cybercore evidence/score/route policy, no-automatic-handoff enforcement, projection, replay, authorization, metadata, event store, core policy, replay determinism, and replay isolation. |
| JSON Schema validation | **24 artifacts valid** | Draft 2020-12 validation passed for 1 intake batch, 1 evidence batch, and all 22 generated OpportunityRecord v2 files, including date and URI formats. |
| Production dependency audit | **0 vulnerabilities** | `npm audit --prefix KERNEL/event-bus --omit=dev --audit-level=high` completed successfully. |

The test commands are:

```bash
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix KERNEL/event-bus
```

## Acceptance command

The repository-contained acceptance workflow was executed from a clean runtime state:

```bash
node CYBERCORE/opportunity_intake/bin/aegentix_cybercore_ingest.js ingest \
  --source opportunity_intake \
  --batch 2026-08-06 \
  --mode normalize_validate \
  --authorization human_required

node CYBERCORE/opportunity_intake/bin/aegentix_cybercore_ingest.js pipeline
node CYBERCORE/opportunity_intake/bin/aegentix_cybercore_ingest.js status --json
```

The authoritative evidence batch contains all 22 intake titles and records the source authority, HTTPS URL, retrieval time, official metadata, per-field checks, evidence classification, and confidence.[1]

## Source-verification results

| Verification or temporal outcome | Count |
|---|---:|
| Evidence items processed | 22 |
| Strictly `VERIFIED` specific opportunities | 13 |
| `NEEDS_SOURCE_VERIFICATION` | 9 |
| `OPEN` | 3 |
| `DEADLINE_TODAY` | 2 |
| `CLOSED` | 7 |
| `FORECAST` | 1 |
| `PROGRAM_ONLY` | 6 |
| `UNKNOWN` exact match | 3 |

Broad categories such as CDMRP programs, NIDILRR programs, World Bank consulting, UNDP supplier opportunities, and NASA strategic technology opportunities retain useful program evidence but do not falsely claim one specific identifier and deadline. Three generic titles with no exact authoritative match remain in source discovery.

Seven specific records were verified as historical or closed. For example, the official World Bank page states an August 5, 2026 closing date for solicitation `0002022855`, and the SAM.gov DHS maritime CSO page identifies an August 5, 2026 offers-due date; neither was treated as open on August 6.[2] [3]

## Strategic intelligence results

Only the 13 strictly verified records were scored. Nine nonverified records were skipped rather than assigned invented values.

| Scoring outcome | Count |
|---|---:|
| Records selected | 22 |
| Records scored | 13 |
| Records skipped as unverified | 9 |
| Recommended `P0` | 0 |
| Recommended `P1` | 1 |
| Recommended `P2` | 12 |

The highest score was **75.6** for NSF AI Infrastructure Hubs, an open opportunity with a November 4, 2026 deadline on the official solicitation.[4] The score is a versioned policy heuristic, not a statistically calibrated probability. Every scored record stores all five dimensions, weights, declared input signals, policy version, and explanation.

## Commercialization-routing results

| Route outcome | Count |
|---|---:|
| Records routed | 22 |
| `READY_FOR_HUMAN_REVIEW` | 5 |
| `MONITOR_FORECAST` | 1 |
| `CLOSED_NO_ACTION` | 7 |
| `PROGRAM_DISCOVERY_ONLY` | 6 |
| `SOURCE_VERIFICATION_REQUIRED` | 3 |
| Treasury Labs handoffs executed | **0** |

The five human-review candidates are:

| Record | Temporal status | Score | Priority | Primary path |
|---|---|---:|---|---|
| NSF AI Infrastructure Hubs | `OPEN` | 75.6 | P1 | `grant` |
| HUD Fair Housing Programs | `OPEN` | 64.6 | P2 | `grant` |
| NSF E-RISE | `OPEN` | 63.9 | P2 | `grant` |
| DOE ARPA-E HORNIG | `DEADLINE_TODAY` | 62.8 | P2 | `grant` |
| Promise Neighborhoods | `DEADLINE_TODAY` | 48.1 | P2 | `grant` |

The official HUD opportunity closes November 2, 2026, and the official NSF E-RISE solicitation establishes the annual second-Tuesday-in-August deadline used for August 11, 2026.[5] [6] ARPA-E HORNIG and Promise Neighborhoods both carried an August 6, 2026 deadline on the retrieved official sources; `DEADLINE_TODAY` therefore requires immediate human confirmation of cutoff time rather than an assumption that submission remains available.[7] [8]

## Durable artifacts

| Artifact | Observed count |
|---|---:|
| Normalized records | 22 |
| Validated-stage records | 13 |
| Strategic-queue records | 13 |
| Commercial-pipeline records | 5 |
| Archived historical records | 7 |
| Authorization artifacts | 0 |
| Run manifests | 4 |
| Append-only opportunity events | 79 |

The 79 events comprise 22 discovery events, 22 source-verification events, 13 intelligence-scoring events, and 22 commercial-routing events. All events are projection-only in the Kernel; replay does not invoke the router.

## Live Kernel and replay evidence

A fresh Kernel was started on an isolated port with `EVENT_STORE_PATH=/tmp/aegentix-kernel-v2-events.jsonl`. The complete ingest and pipeline ran with `--kernel-required`, so any publication failure would have failed the operation.

| Live metric | Observed result |
|---|---:|
| Events published | 79 |
| Publication failures | 0 |
| Persisted events | 79 |
| Projected opportunities | 22 |
| Projected human-review records | 5 |
| Projected authorized records | 0 |
| Configured store path honored | `/tmp/aegentix-kernel-v2-events.jsonl` |

The Kernel was then stopped and restarted against the same store.

| Replay metric | Observed result |
|---|---:|
| Events applied | 79 |
| Events skipped | 0 |
| Router dispatches | 0 |
| Replay status | `clean` |
| Reconstructed opportunities | 22 |
| Reconstructed verified records | 13 |
| Reconstructed nonverified records | 9 |
| Reconstructed human-review records | 5 |

## Safety conclusion

The implementation enforces these boundaries:

| Boundary | Verified behavior |
|---|---|
| Source evidence changes | Reset downstream intelligence and routes and revoke stale authorization |
| Unverified record | Cannot be scored |
| Unscored verified record | Cannot enter commercial routing |
| Closed, forecast, program-only, or unknown record | Treasury Labs handoff remains `BLOCKED` |
| Ready route | Stops at `HUMAN_REVIEW_REQUIRED` |
| Treasury handoff | `automatic_dispatch: false`; zero handoffs executed |
| External action | Requires a scoped, integrity-bound, unexpired artifact from `human:<identifier>` |
| Replay | Reconstructs state without router dispatch |

> The module produces decision-support state and authorization evidence. It does not perform the business action represented by an authorization.

## References

[1]: evidence/source-verification-2026-08-06.json "AEGENTIX Cybercore source-verification evidence batch"
[2]: https://www.worldbank.org/en/about/corporate-procurement/business-opportunities/administrative-procurement/rfxnow-2022855-feedstock-supply-chain-logistics-and-refinery-port-interface-assessment-for-saf-production-in-ke "World Bank solicitation 0002022855"
[3]: https://sam.gov/opp/32923c9e47ed4f6b828c8bd0531c1286/view "DHS Maritime Capabilities and Innovation CSO"
[4]: https://www.nsf.gov/funding/opportunities/us-national-science-foundation-state-regional-artificial/nsf26-513/solicitation "NSF 26-513 AI Infrastructure Hubs"
[5]: https://simpler.grants.gov/opportunity/224cb740-46ae-4eab-bdb5-d858638ee591 "HUD Fair Housing Initiatives Program opportunity"
[6]: https://www.nsf.gov/funding/opportunities/e-rise-epscor-research-infrastructure-improvement-program-epscor/nsf25-522/solicitation "NSF 25-522 E-RISE"
[7]: https://arpa-e.energy.gov/programs-and-initiatives/view-all-programs/hornig "ARPA-E HORNIG"
[8]: https://simpler.grants.gov/opportunity/570d18d4-f665-48ed-bf1e-57e8b6789186 "Promise Neighborhoods opportunity"
