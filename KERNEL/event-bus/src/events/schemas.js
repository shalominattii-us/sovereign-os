/**
 * Canonical event type registry for WorldMonitor.
 *
 * Each domain owns its event types. This file is the single source of truth
 * for all valid event type strings used across the system.
 *
 * Treasury events upgraded to full wallet v1/v2/v3 canonical set.
 */
export const EventTypes = {
  // ── Robotics domain ────────────────────────────────────────────────────────
  MOVE_COMMAND:   "MOVE_COMMAND",
  STOP_COMMAND:   "STOP_COMMAND",
  STATUS_UPDATE:  "STATUS_UPDATE",

  // ── Treasury domain — wallet lifecycle ────────────────────────────────────
  WALLET_CREATED:       "WALLET_CREATED",
  WALLET_FROZEN:        "WALLET_FROZEN",
  WALLET_UNFROZEN:      "WALLET_UNFROZEN",

  // ── Treasury domain — deposits & withdrawals ──────────────────────────────
  DEPOSIT_RECORDED:     "DEPOSIT_RECORDED",
  WITHDRAWAL_INITIATED: "WITHDRAWAL_INITIATED",
  WITHDRAWAL_APPROVED:  "WITHDRAWAL_APPROVED",
  WITHDRAWAL_REJECTED:  "WITHDRAWAL_REJECTED",
  WITHDRAWAL_EXPIRED:   "WITHDRAWAL_EXPIRED",
  WITHDRAWAL_RECORDED:  "WITHDRAWAL_RECORDED",

  // ── Treasury domain — transfers ───────────────────────────────────────────
  TRANSFER_INTENT:      "TRANSFER_INTENT",
  TRANSFER_DEBIT:       "TRANSFER_DEBIT",
  TRANSFER_CREDIT:      "TRANSFER_CREDIT",

  // ── Treasury domain — balances & snapshots ────────────────────────────────
  BALANCE_SNAPSHOT:     "BALANCE_SNAPSHOT",
  XVLSO_SYNC:           "XVLSO_SYNC",

  // ── Treasury domain — identity & signing ─────────────────────────────────
  DID_REVOKED:          "DID_REVOKED",
  SIGNER_DELEGATED:     "SIGNER_DELEGATED",
  SIGNER_REVOKED:       "SIGNER_REVOKED",
  SIGNATURE_REJECTED:   "SIGNATURE_REJECTED",

  // ── Treasury domain — policy & audit ─────────────────────────────────────
  POLICY_VIOLATION:     "POLICY_VIOLATION",
  ASSET_REGISTERED:     "ASSET_REGISTERED",
  CORRECTION_ISSUED:    "CORRECTION_ISSUED",

  // ── XR domain ─────────────────────────────────────────────────────────────
  SCENE_LOAD:     "SCENE_LOAD",
  AVATAR_SPAWN:   "AVATAR_SPAWN",

  // ── Cybercore opportunity-intake domain ────────────────────────────────────
  OPPORTUNITY_DISCOVERED:              "OPPORTUNITY_DISCOVERED",
  OPPORTUNITY_MERGED:                  "OPPORTUNITY_MERGED",
  OPPORTUNITY_VALIDATED:               "OPPORTUNITY_VALIDATED",
  OPPORTUNITY_SOURCE_VERIFIED:          "OPPORTUNITY_SOURCE_VERIFIED",
  OPPORTUNITY_INTELLIGENCE_SCORED:      "OPPORTUNITY_INTELLIGENCE_SCORED",
  OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED: "OPPORTUNITY_COMMERCIAL_ROUTE_IDENTIFIED",
  OPPORTUNITY_STATE_TRANSITIONED:      "OPPORTUNITY_STATE_TRANSITIONED",
  OPPORTUNITY_REVIEW_QUEUED:           "OPPORTUNITY_REVIEW_QUEUED",
  OPPORTUNITY_AUTHORIZATION_RECORDED:  "OPPORTUNITY_AUTHORIZATION_RECORDED",
  OPPORTUNITY_ARCHIVED:                "OPPORTUNITY_ARCHIVED",
};

/**
 * Domains supported by WorldMonitor.
 */
export const Domains = {
  ROBOTICS: "robotics",
  TREASURY: "treasury",
  XR:        "xr",
  EXCHANGE:  "exchange",
  CYBERCORE: "cybercore",
};
