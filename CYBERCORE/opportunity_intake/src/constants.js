export const RECORD_SCHEMA_VERSION = "1.0.0";
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
  OPPORTUNITY_STATE_TRANSITIONED: "OPPORTUNITY_STATE_TRANSITIONED",
  OPPORTUNITY_REVIEW_QUEUED: "OPPORTUNITY_REVIEW_QUEUED",
  OPPORTUNITY_AUTHORIZATION_RECORDED: "OPPORTUNITY_AUTHORIZATION_RECORDED",
  OPPORTUNITY_ARCHIVED: "OPPORTUNITY_ARCHIVED",
});

export const ROUTES = Object.freeze({
  FUNDING_GRANTS: "CYBERCORE/FUNDING/GRANTS",
  PROCUREMENT: "CYBERCORE/PROCUREMENT",
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
  "unknown",
]);
