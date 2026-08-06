export const RECORD_SCHEMA_VERSION = "2.0.0";
export const EVIDENCE_SCHEMA_VERSION = "1.0.0";
export const INTELLIGENCE_POLICY_VERSION = "1.0.0";
export const COMMERCIALIZATION_POLICY_VERSION = "1.0.0";
export const EVENT_VERSION = 1;
export const CYBERCORE_DOMAIN = "cybercore";
export const DEFAULT_SOURCE = "opportunity_intake";
export const AUTHORIZATION_MODE = "human_required";

export const ACTION_STATES = Object.freeze({
  DISCOVERED: "DISCOVERED",
  VALIDATED: "VALIDATED",
  STRATEGIC_MATCHED: "STRATEGIC_MATCHED",
  REVENUE_PATH_IDENTIFIED: "REVENUE_PATH_IDENTIFIED",
  HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED",
  AUTHORIZED_ACTION: "AUTHORIZED_ACTION",
});

export const STATE_ORDER = Object.freeze([
  ACTION_STATES.DISCOVERED,
  ACTION_STATES.VALIDATED,
  ACTION_STATES.STRATEGIC_MATCHED,
  ACTION_STATES.REVENUE_PATH_IDENTIFIED,
  ACTION_STATES.HUMAN_REVIEW_REQUIRED,
  ACTION_STATES.AUTHORIZED_ACTION,
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  [ACTION_STATES.DISCOVERED]: Object.freeze([ACTION_STATES.VALIDATED]),
  [ACTION_STATES.VALIDATED]: Object.freeze([ACTION_STATES.STRATEGIC_MATCHED]),
  [ACTION_STATES.STRATEGIC_MATCHED]: Object.freeze([ACTION_STATES.REVENUE_PATH_IDENTIFIED]),
  [ACTION_STATES.REVENUE_PATH_IDENTIFIED]: Object.freeze([ACTION_STATES.HUMAN_REVIEW_REQUIRED]),
  [ACTION_STATES.HUMAN_REVIEW_REQUIRED]: Object.freeze([ACTION_STATES.AUTHORIZED_ACTION]),
  [ACTION_STATES.AUTHORIZED_ACTION]: Object.freeze([ACTION_STATES.HUMAN_REVIEW_REQUIRED]),
});

export const PRIORITIES = Object.freeze({
  P0: "P0",
  P1: "P1",
  P2: "P2",
});

export const STRATEGIC_TIERS = Object.freeze({
  TIER_1: Object.freeze({ label: "Tier 1", score: 100 }),
  TIER_2: Object.freeze({ label: "Tier 2", score: 70 }),
  TIER_3: Object.freeze({ label: "Tier 3", score: 40 }),
  UNASSESSED: Object.freeze({ label: "Unassessed", score: null }),
});

export const OPPORTUNITY_TYPES = Object.freeze([
  "funding",
  "procurement",
  "challenge_prize",
  "technology_need",
]);

export const PROCUREMENT_TYPES = Object.freeze([
  "RFP",
  "RFI",
  "CSO",
  "OTA",
  "cooperative_agreement",
  "consulting",
]);

export const MARKET_ENTRY_TYPES = Object.freeze([
  "prime",
  "subcontractor",
  "technology_partner",
  "consortium_member",
]);

export const EXTERNAL_ACTIONS = Object.freeze([
  "submission",
  "registration",
  "bid",
  "contract",
  "financial_commitment",
  "external_communication",
]);

export const EVENT_TYPES = Object.freeze({
  OPPORTUNITY_DISCOVERED: "OPPORTUNITY_DISCOVERED",
  OPPORTUNITY_MERGED: "OPPORTUNITY_MERGED",
  OPPORTUNITY_VALIDATED: "OPPORTUNITY_VALIDATED",
  OPPORTUNITY_SOURCE_VERIFIED: "OPPORTUNITY_SOURCE_VERIFIED",
  OPPORTUNITY_INTELLIGENCE_SCORED: "OPPORTUNITY_INTELLIGENCE_SCORED",
  OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED: "OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED",
  OPPORTUNITY_STATE_TRANSITIONED: "OPPORTUNITY_STATE_TRANSITIONED",
  OPPORTUNITY_REVIEW_QUEUED: "OPPORTUNITY_REVIEW_QUEUED",
  OPPORTUNITY_AUTHORIZATION_RECORDED: "OPPORTUNITY_AUTHORIZATION_RECORDED",
  OPPORTUNITY_ARCHIVED: "OPPORTUNITY_ARCHIVED",
});

export const ROUTES = Object.freeze({
  FUNDING_GRANTS: "CYBERCORE/FUNDING/GRANTS",
  PROCUREMENT: "CYBERCORE/PROCUREMENT",
  CHALLENGE_PRIZE: "CYBERCORE/CHALLENGES_PRIZES",
  TECHNOLOGY_NEED: "CYBERCORE/TECHNOLOGY_NEEDS",
});

export const EVIDENCE_CLASSIFICATIONS = Object.freeze([
  "VERIFIED_ACTIVE",
  "VERIFIED_FORECAST",
  "VERIFIED_PROGRAM",
  "HISTORICAL",
  "GENERIC_CATEGORY",
  "NO_AUTHORITATIVE_MATCH",
]);

export const TEMPORAL_STATUSES = Object.freeze([
  "OPEN",
  "DEADLINE_TODAY",
  "CLOSED",
  "FORECAST",
  "PROGRAM_ONLY",
  "UNKNOWN",
]);

export const COMMERCIAL_PATHS = Object.freeze([
  "grant",
  "research_partnership",
  "prime_bid",
  "subcontractor_position",
  "prototype_demonstration",
  "licensing_commercialization",
  "supplier_contract",
  "consulting_engagement",
]);

export const COMMERCIAL_ROUTE_STATUSES = Object.freeze({
  NOT_EVALUATED: "NOT_EVALUATED",
  READY_FOR_HUMAN_REVIEW: "READY_FOR_HUMAN_REVIEW",
  MONITOR_FORECAST: "MONITOR_FORECAST",
  CLOSED_NO_ACTION: "CLOSED_NO_ACTION",
  PROGRAM_DISCOVERY_ONLY: "PROGRAM_DISCOVERY_ONLY",
  SOURCE_VERIFICATION_REQUIRED: "SOURCE_VERIFICATION_REQUIRED",
  NO_ROUTE_IDENTIFIED: "NO_ROUTE_IDENTIFIED",
});

export const TREASURY_HANDOFF_STATUSES = Object.freeze({
  NOT_EVALUATED: "NOT_EVALUATED",
  HUMAN_APPROVAL_REQUIRED: "HUMAN_APPROVAL_REQUIRED",
  BLOCKED: "BLOCKED",
});

export const VALIDATION_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  NEEDS_SOURCE_VERIFICATION: "NEEDS_SOURCE_VERIFICATION",
  INVALID: "INVALID",
});

export const RECORD_STATUSES = Object.freeze([
  "forecast",
  "active",
  "amended",
  "extended",
  "cancelled",
  "awarded",
  "closed",
  "historical",
  "program",
  "unknown",
]);
