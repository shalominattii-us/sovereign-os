import { state } from "./worldState.js";

/**
 * Projector
 *
 * Applies a single event to the world state.
 * This is the only place world state is mutated.
 * Because all mutations flow through here, state can always be
 * rebuilt by replaying the full event log from disk.
 *
 * Treasury projection upgraded to full wallet v1/v2/v3 canonical event set.
 *
 * @param {Object} event - Enriched, validated event
 */
export function apply(event) {
  state.eventCount += 1;

  switch (event.domain) {
    case "robotics":
      applyRobotics(event);
      break;

    case "treasury":
      applyTreasury(event);
      break;

    case "xr":
      applyXR(event);
      break;

    case "cybercore":
      applyCybercore(event);
      break;

    default:
      // Unknown domain — record it but don't mutate known state slices
      break;
  }
}

// ── Robotics ──────────────────────────────────────────────────────────────────
function applyRobotics(event) {
  const current = state.robots[event.entity_id] || {};
  state.robots[event.entity_id] = {
    ...current,
    lastCommand: event.payload,
    position:    event.payload.position ?? current.position ?? null,
    updated:     event.timestamp,
  };
}

// ── Treasury ──────────────────────────────────────────────────────────────────
/**
 * Treasury world state shape per wallet entity:
 * {
 *   walletId:   string,
 *   ownerDid:   string | null,
 *   type:       string,
 *   version:    string,
 *   assets:     { [symbol]: number },   // current balances
 *   frozen:     boolean,
 *   signers:    string[],
 *   lastTx:     object,
 *   updated:    number
 * }
 */
function applyTreasury(event) {
  const id      = event.entity_id;
  const payload = event.payload;
  const current = state.treasury[id] || {
    walletId: id,
    ownerDid: null,
    type:     'unknown',
    version:  '1.0.0',
    assets:   {},
    frozen:   false,
    signers:  [],
    lastTx:   null,
    updated:  null
  };

  switch (event.type) {

    // ── Wallet lifecycle ────────────────────────────────────────────────────
    case "WALLET_CREATED":
      state.treasury[id] = {
        ...current,
        walletId: id,
        ownerDid: payload.ownerDid || payload.ownerId || null,
        type:     payload.type    || 'sovereign',
        version:  payload.version || '1.0.0',
        signers:  payload.ownerDid ? [payload.ownerDid] : [],
        lastTx:   payload,
        updated:  event.timestamp
      };
      break;

    case "WALLET_FROZEN":
      state.treasury[id] = { ...current, frozen: true, lastTx: payload, updated: event.timestamp };
      break;

    case "WALLET_UNFROZEN":
      state.treasury[id] = { ...current, frozen: false, lastTx: payload, updated: event.timestamp };
      break;

    // ── Deposits ────────────────────────────────────────────────────────────
    case "DEPOSIT_RECORDED": {
      const assets = { ...current.assets };
      assets[payload.asset] = (assets[payload.asset] || 0) + payload.amount;
      state.treasury[id] = { ...current, assets, lastTx: payload, updated: event.timestamp };
      break;
    }

    // ── Withdrawals ─────────────────────────────────────────────────────────
    case "WITHDRAWAL_INITIATED":
    case "WITHDRAWAL_APPROVED":
    case "WITHDRAWAL_REJECTED":
    case "WITHDRAWAL_EXPIRED":
      state.treasury[id] = { ...current, lastTx: payload, updated: event.timestamp };
      break;

    case "WITHDRAWAL_RECORDED": {
      const assets = { ...current.assets };
      assets[payload.asset] = (assets[payload.asset] || 0) - payload.amount;
      state.treasury[id] = { ...current, assets, lastTx: payload, updated: event.timestamp };
      break;
    }

    // ── Transfers ────────────────────────────────────────────────────────────
    case "TRANSFER_DEBIT": {
      const assets = { ...current.assets };
      assets[payload.asset] = (assets[payload.asset] || 0) - payload.amount;
      state.treasury[id] = { ...current, assets, lastTx: payload, updated: event.timestamp };
      break;
    }

    case "TRANSFER_CREDIT": {
      const assets = { ...current.assets };
      assets[payload.asset] = (assets[payload.asset] || 0) + payload.amount;
      state.treasury[id] = { ...current, assets, lastTx: payload, updated: event.timestamp };
      break;
    }

    case "TRANSFER_INTENT":
      state.treasury[id] = { ...current, lastTx: payload, updated: event.timestamp };
      break;

    // ── Balances & snapshots ─────────────────────────────────────────────────
    case "BALANCE_SNAPSHOT":
    case "XVLSO_SYNC":
      state.treasury[id] = { ...current, lastTx: payload, updated: event.timestamp };
      break;

    // ── Identity & signing ───────────────────────────────────────────────────
    case "SIGNER_DELEGATED": {
      const signers = current.signers.includes(payload.signerDid)
        ? current.signers
        : [...current.signers, payload.signerDid];
      state.treasury[id] = { ...current, signers, lastTx: payload, updated: event.timestamp };
      break;
    }

    case "SIGNER_REVOKED": {
      const signers = current.signers.filter(s => s !== payload.signerDid);
      state.treasury[id] = { ...current, signers, lastTx: payload, updated: event.timestamp };
      break;
    }

    case "DID_REVOKED":
    case "SIGNATURE_REJECTED":
    case "POLICY_VIOLATION":
      state.treasury[id] = { ...current, lastTx: payload, updated: event.timestamp };
      break;

    // ── Corrections ──────────────────────────────────────────────────────────
    case "CORRECTION_ISSUED": {
      const assets = { ...current.assets };
      assets[payload.asset] = payload.corrected_balance;
      state.treasury[id] = { ...current, assets, lastTx: payload, updated: event.timestamp };
      break;
    }

    // ── Asset registration ───────────────────────────────────────────────────
    case "ASSET_REGISTERED":
      state.treasury[id] = { ...current, lastTx: payload, updated: event.timestamp };
      break;

    default:
      // Unknown treasury event — record last payload without further mutation
      state.treasury[id] = { ...current, lastTx: payload, updated: event.timestamp };
      break;
  }
}

// ── XR ────────────────────────────────────────────────────────────────────────
function applyXR(event) {
  const current = state.xr[event.entity_id] || {};
  state.xr[event.entity_id] = {
    ...current,
    lastEvent: event.payload,
    updated:   event.timestamp,
  };
}

// ── Cybercore opportunity intake ─────────────────────────────────────────────
function queueOpportunity(record) {
  for (const priority of Object.keys(state.cybercore.queues)) {
    state.cybercore.queues[priority] = state.cybercore.queues[priority]
      .filter((recordId) => recordId !== record.id);
  }
  if (record.priority && state.cybercore.queues[record.priority]) {
    state.cybercore.queues[record.priority].push(record.id);
  }
}

function applyCybercore(event) {
  const id = event.entity_id;
  const current = state.cybercore.opportunities[id] || null;

  switch (event.type) {
    case "OPPORTUNITY_DISCOVERED":
    case "OPPORTUNITY_MERGED": {
      const record = event.payload.record;
      state.cybercore.opportunities[id] = {
        ...record,
        last_event_id: event.event_id,
        projected_at: event.timestamp,
      };
      queueOpportunity(record);
      break;
    }

    case "OPPORTUNITY_VALIDATED":
    case "OPPORTUNITY_STATE_TRANSITIONED":
    case "OPPORTUNITY_REVIEW_QUEUED":
      if (current) {
        state.cybercore.opportunities[id] = {
          ...current,
          ...(event.payload.record || {}),
          action_state: event.payload.action_state || current.action_state,
          last_event_id: event.event_id,
          projected_at: event.timestamp,
        };
        queueOpportunity(state.cybercore.opportunities[id]);
      }
      break;

    case "OPPORTUNITY_AUTHORIZATION_RECORDED":
      state.cybercore.authorizations[event.payload.authorization.authorization_id] = event.payload.authorization;
      if (current) {
        state.cybercore.opportunities[id] = {
          ...current,
          action_state: "AUTHORIZED_ACTION",
          authorization: {
            ...current.authorization,
            status: "AUTHORIZED",
            authorization_id: event.payload.authorization.authorization_id,
            approved_action: event.payload.authorization.action,
            authorized_by: event.payload.authorization.authorized_by,
            authorized_at: event.payload.authorization.authorized_at,
            expires_at: event.payload.authorization.expires_at,
          },
          last_event_id: event.event_id,
          projected_at: event.timestamp,
        };
      }
      break;

    case "OPPORTUNITY_ARCHIVED":
      if (current) {
        state.cybercore.opportunities[id] = {
          ...current,
          record_status: event.payload.record_status || "archived",
          last_event_id: event.event_id,
          projected_at: event.timestamp,
        };
      }
      break;

    default:
      break;
  }
}
