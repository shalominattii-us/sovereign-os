/**
 * AEGENTIS CORPORATION — Wallet v3 DID Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight Decentralised Identifier (DID) registry for sovereign wallets.
 *
 * A DID document holds:
 *   - did          : string  e.g. "did:sovereign:abc123"
 *   - publicKey    : string  (hex-encoded Ed25519 public key)
 *   - roles        : string[] e.g. ['owner', 'signer', 'auditor']
 *   - wallets      : string[] linked wallet IDs
 *   - created_at   : number
 *   - revoked      : boolean
 *
 * Signature verification uses Node's built-in `crypto` module with Ed25519.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

class DIDRegistry {
  constructor() {
    /** @type {Map<string, Object>} did → DID document */
    this.identities = new Map();
  }

  /**
   * Register a new DID with an Ed25519 public key.
   * @param {string} did        - e.g. "did:sovereign:abc123"
   * @param {string} publicKey  - hex-encoded Ed25519 public key (64 chars)
   * @param {string[]} roles    - ['owner','signer','auditor',...]
   * @returns {Object} DID document
   */
  register(did, publicKey, roles = ['owner']) {
    if (this.identities.has(did)) {
      throw new Error(`DID already registered: ${did}`);
    }
    const doc = {
      did,
      publicKey,
      roles,
      wallets:    [],
      created_at: Date.now(),
      revoked:    false
    };
    this.identities.set(did, doc);
    return doc;
  }

  /**
   * Link a wallet to a DID.
   */
  linkWallet(did, walletId) {
    const doc = this._get(did);
    if (!doc.wallets.includes(walletId)) doc.wallets.push(walletId);
    return doc;
  }

  /**
   * Revoke a DID — it can no longer sign transactions.
   */
  revoke(did) {
    const doc = this._get(did);
    doc.revoked = true;
    return doc;
  }

  /**
   * Verify an Ed25519 signature over `message` using the DID's registered key.
   * @param {string} did       - signer DID
   * @param {string} message   - UTF-8 message that was signed
   * @param {string} signature - hex-encoded signature
   * @returns {{ ok: boolean, error?: string }}
   */
  verifySignature(did, message, signature) {
    const doc = this.identities.get(did);
    if (!doc)         return { ok: false, error: 'DID not found' };
    if (doc.revoked)  return { ok: false, error: 'DID has been revoked' };

    try {
      const pubKeyObj = crypto.createPublicKey({
        key:    Buffer.from(doc.publicKey, 'hex'),
        format: 'der',
        type:   'spki'
      });
      const valid = crypto.verify(
        null,
        Buffer.from(message, 'utf8'),
        pubKeyObj,
        Buffer.from(signature, 'hex')
      );
      return valid ? { ok: true } : { ok: false, error: 'Invalid signature' };
    } catch (err) {
      return { ok: false, error: `Signature verification error: ${err.message}` };
    }
  }

  /**
   * Check whether a DID has a specific role.
   */
  hasRole(did, role) {
    const doc = this.identities.get(did);
    return doc && !doc.revoked && doc.roles.includes(role);
  }

  get(did) {
    return this.identities.get(did) || null;
  }

  _get(did) {
    const doc = this.identities.get(did);
    if (!doc) throw new Error(`DID not found: ${did}`);
    return doc;
  }

  list() {
    return Array.from(this.identities.values());
  }
}

module.exports = new DIDRegistry();
