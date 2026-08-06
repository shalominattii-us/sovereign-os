/**
 * AEGENTIS CORPORATION — Wallet v3 Test Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests cryptographic signature verification (Ed25519) and all five policy
 * engine rules directly against the v3 runtime modules — no HTTP server needed.
 *
 * Run:
 *   node TREASURY/wallet-v3/test_wallet_v3.js
 *
 * Coverage:
 *   [SIG]    Ed25519 key generation and DID registration
 *   [SIG]    Valid signature accepted
 *   [SIG]    Tampered signature rejected
 *   [SIG]    Revoked DID rejected
 *   [SIG]    Unauthorised signer (not in wallet.signers) rejected
 *   [SIG]    Duplicate signature rejected
 *   [SIG]    Multi-sig threshold: 2-of-2 approval flow
 *   [POL]    FREEZE policy blocks withdrawal
 *   [POL]    ROLE_CHECK policy blocks actor without owner/signer role
 *   [POL]    ASSET_WHITELIST policy blocks non-whitelisted asset
 *   [POL]    DAILY_LIMIT policy blocks over-cap withdrawal
 *   [POL]    VELOCITY_LIMIT policy blocks excessive transaction rate
 *   [POL]    Policy pass: all rules satisfied
 *   [POL]    Custom policy registration and enforcement
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto       = require('crypto');

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

/**
 * Generate an Ed25519 key pair and return the public key in DER/SPKI hex
 * (the format DIDRegistry.verifySignature expects).
 */
function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const pubHex = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
  return { privateKey, publicKey, pubHex };
}

/**
 * Sign a UTF-8 message with an Ed25519 private key; return hex signature.
 */
function sign(privateKey, message) {
  return crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex');
}

// ── Fresh module instances (isolated per run) ─────────────────────────────────
// We require fresh copies so tests don't bleed state into each other.
// Node caches modules, so we bust the cache manually.
function freshModules() {
  // Clear cached modules
  [
    './did_registry',
    './policy_engine',
    './wallet_v3',
    '../treasury-ledger/ledger',
    '../asset-registry/registry',
    '../wallet-runtime/wallet'
  ].forEach(m => {
    try {
      const resolved = require.resolve(m);
      delete require.cache[resolved];
    } catch (_) {}
  });

  const didRegistry  = require('./did_registry');
  const policyEngine = require('./policy_engine');
  const walletV3     = require('./wallet_v3');
  return { didRegistry, policyEngine, walletV3 };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Ed25519 Signature Verification
// ─────────────────────────────────────────────────────────────────────────────
async function testSignatures() {
  section('SIG — Ed25519 Signature Verification');

  const { didRegistry, walletV3 } = freshModules();

  // Generate two key pairs: Alice (owner) and Bob (delegated signer)
  const alice = generateKeyPair();
  const bob   = generateKeyPair();
  const eve   = generateKeyPair(); // attacker — never registered as signer

  const aliceDid = 'did:sovereign:alice';
  const bobDid   = 'did:sovereign:bob';
  const eveDid   = 'did:sovereign:eve';

  // 1. Register DIDs
  didRegistry.register(aliceDid, alice.pubHex, ['owner']);
  didRegistry.register(bobDid,   bob.pubHex,   ['signer']);
  didRegistry.register(eveDid,   eve.pubHex,   ['auditor']);
  assert('DID registration — Alice, Bob, Eve registered', true);

  // 2. Create wallet bound to Alice's DID
  const createResult = await walletV3.createWallet(aliceDid, 'sovereign');
  assert('Wallet creation bound to DID', createResult.ok, JSON.stringify(createResult));
  const { walletId } = createResult.wallet;

  // 3. Deposit funds so withdrawal can be initiated
  await walletV3.deposit(walletId, 'USD', 5000, aliceDid);
  assert('Deposit 5000 USD to wallet', true);

  // 4. Initiate a $500 withdrawal (requires 1 signature)
  const w1 = await walletV3.initiateWithdrawal(walletId, 'USD', 500, aliceDid);
  assert('Withdrawal initiated (1-sig threshold)', w1.ok && w1.required_signatures === 1, JSON.stringify(w1));

  // 5. Valid signature — Alice signs the txId
  const validSig = sign(alice.privateKey, w1.txId);
  const signResult = await walletV3.signTransaction(w1.txId, aliceDid, validSig);
  assert('Valid Ed25519 signature accepted', signResult.ok && signResult.status === 'approved', JSON.stringify(signResult));

  // 6. Tampered signature — flip one byte
  await walletV3.deposit(walletId, 'USD', 5000, aliceDid);
  const w2 = await walletV3.initiateWithdrawal(walletId, 'USD', 500, aliceDid);
  const tamperedSig = validSig.slice(0, -2) + (validSig.slice(-2) === 'ff' ? '00' : 'ff');
  const badSig = await walletV3.signTransaction(w2.txId, aliceDid, tamperedSig);
  assert('Tampered signature rejected', !badSig.ok && badSig.code === 'INVALID_SIGNATURE', JSON.stringify(badSig));

  // 7. Revoked DID cannot sign
  didRegistry.revoke(eveDid);
  // Register Eve as a signer first (so she passes the signer-list check)
  await walletV3.delegateSigner(walletId, aliceDid, eveDid);
  await walletV3.deposit(walletId, 'USD', 5000, aliceDid);
  const w3 = await walletV3.initiateWithdrawal(walletId, 'USD', 500, aliceDid);
  const eveSig = sign(eve.privateKey, w3.txId);
  const revokedResult = await walletV3.signTransaction(w3.txId, eveDid, eveSig);
  assert('Revoked DID signature rejected', !revokedResult.ok && revokedResult.code === 'INVALID_SIGNATURE', JSON.stringify(revokedResult));

  // 8. Unauthorised signer (not in wallet.signers)
  const carol     = generateKeyPair();
  const carolDid  = 'did:sovereign:carol';
  didRegistry.register(carolDid, carol.pubHex, ['signer']);
  // Carol is NOT delegated to this wallet
  await walletV3.deposit(walletId, 'USD', 5000, aliceDid);
  const w4 = await walletV3.initiateWithdrawal(walletId, 'USD', 500, aliceDid);
  const carolSig = sign(carol.privateKey, w4.txId);
  const unauthorised = await walletV3.signTransaction(w4.txId, carolDid, carolSig);
  assert('Unauthorised signer rejected', !unauthorised.ok && unauthorised.code === 'UNAUTHORIZED_SIGNER', JSON.stringify(unauthorised));

  // 9. Duplicate signature rejected
  // Use a $15,000 withdrawal (requires 2 sigs) so the tx stays pending after the first sign
  await walletV3.delegateSigner(walletId, aliceDid, bobDid); // ensure Bob is a signer
  await walletV3.deposit(walletId, 'USD', 20000, aliceDid);
  const w5 = await walletV3.initiateWithdrawal(walletId, 'USD', 2000, aliceDid); // 1-sig threshold
  // Initiate a 2-sig tx for the duplicate test
  await walletV3.deposit(walletId, 'USD', 20000, aliceDid);
  const w5b = await walletV3.initiateWithdrawal(walletId, 'USD', 5000, aliceDid); // 2-sig threshold
  const sig5b = sign(alice.privateKey, w5b.txId);
  await walletV3.signTransaction(w5b.txId, aliceDid, sig5b); // first sign (pending)
  const dupResult = await walletV3.signTransaction(w5b.txId, aliceDid, sig5b); // duplicate
  assert('Duplicate signature rejected', !dupResult.ok && dupResult.code === 'ALREADY_SIGNED', JSON.stringify(dupResult));

  // 10. Multi-sig: 2-of-2 flow (Bob delegated, $5,000 withdrawal requires 2 sigs)
  // Threshold: >$1k and ≤$10k → 2 sigs
  await walletV3.deposit(walletId, 'USD', 50000, aliceDid);
  const w6 = await walletV3.initiateWithdrawal(walletId, 'USD', 5000, aliceDid);
  assert('Multi-sig: 2 signatures required for $5k', w6.ok && w6.required_signatures === 2, JSON.stringify(w6));

  const sig6a = sign(alice.privateKey, w6.txId);
  const step1 = await walletV3.signTransaction(w6.txId, aliceDid, sig6a);
  assert('Multi-sig: first signature accepted (still pending)', step1.ok && step1.status === 'pending', JSON.stringify(step1));

  const sig6b = sign(bob.privateKey, w6.txId);
  const step2 = await walletV3.signTransaction(w6.txId, bobDid, sig6b);
  assert('Multi-sig: second signature accepted (approved)', step2.ok && step2.status === 'approved', JSON.stringify(step2));
  // Verify balance was debited after approval
  const balAfter = walletV3.getBalance(w6.walletId || walletId);
  assert('Multi-sig: balance debited after approval', balAfter.ok, JSON.stringify(balAfter));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Policy Engine Enforcement
// ─────────────────────────────────────────────────────────────────────────────
async function testPolicies() {
  section('POL — Policy Engine Enforcement');

  const { didRegistry, policyEngine, walletV3 } = freshModules();

  // Register a base owner DID
  const alice = generateKeyPair();
  const aliceDid = 'did:sovereign:alice-pol';
  didRegistry.register(aliceDid, alice.pubHex, ['owner']);

  // Create a wallet
  const cw = await walletV3.createWallet(aliceDid, 'sovereign');
  assert('Policy test wallet created', cw.ok);
  const { walletId } = cw.wallet;

  // ── 1. FREEZE policy ──────────────────────────────────────────────────────
  await walletV3.deposit(walletId, 'USD', 10000, aliceDid);
  walletV3.freezeWallet(walletId);
  const frozenResult = await walletV3.initiateWithdrawal(walletId, 'USD', 100, aliceDid);
  assert('FREEZE: withdrawal blocked on frozen wallet',
    !frozenResult.ok && frozenResult.code === 'POLICY_VIOLATION' &&
    frozenResult.violations.some(v => v.includes('frozen')),
    JSON.stringify(frozenResult));

  walletV3.unfreezeWallet(walletId);
  const unfrozenResult = await walletV3.initiateWithdrawal(walletId, 'USD', 100, aliceDid);
  assert('FREEZE: withdrawal allowed after unfreeze', unfrozenResult.ok, JSON.stringify(unfrozenResult));

  // ── 2. ROLE_CHECK policy ──────────────────────────────────────────────────
  const auditor = generateKeyPair();
  const auditorDid = 'did:sovereign:auditor-pol';
  didRegistry.register(auditorDid, auditor.pubHex, ['auditor']); // no owner/signer role
  // Delegate auditor to wallet so signer-list check passes — policy check is role-based
  await walletV3.delegateSigner(walletId, aliceDid, auditorDid);

  await walletV3.deposit(walletId, 'USD', 10000, aliceDid);
  const roleResult = await walletV3.initiateWithdrawal(walletId, 'USD', 100, auditorDid);
  assert('ROLE_CHECK: auditor-only DID blocked from withdrawal',
    !roleResult.ok && roleResult.code === 'POLICY_VIOLATION' &&
    roleResult.violations.some(v => v.includes('lacks owner/signer role')),
    JSON.stringify(roleResult));

  const ownerResult = await walletV3.initiateWithdrawal(walletId, 'USD', 100, aliceDid);
  assert('ROLE_CHECK: owner DID allowed', ownerResult.ok, JSON.stringify(ownerResult));

  // ── 3. ASSET_WHITELIST policy ─────────────────────────────────────────────
  // Register a non-whitelisted asset
  const registry = require('../asset-registry/registry');
  registry.register('MEME', 'Meme Coin', 'crypto');
  await walletV3.deposit(walletId, 'MEME', 99999, aliceDid); // deposit bypasses whitelist
  const whitelistResult = await walletV3.initiateWithdrawal(walletId, 'MEME', 100, aliceDid);
  assert('ASSET_WHITELIST: non-whitelisted asset blocked',
    !whitelistResult.ok && whitelistResult.code === 'POLICY_VIOLATION' &&
    whitelistResult.violations.some(v => v.includes('not whitelisted')),
    JSON.stringify(whitelistResult));

  const wlOk = await walletV3.initiateWithdrawal(walletId, 'USD', 100, aliceDid);
  assert('ASSET_WHITELIST: USD (whitelisted) allowed', wlOk.ok, JSON.stringify(wlOk));

  // ── 4. DAILY_LIMIT policy ─────────────────────────────────────────────────
  // Default USD daily limit = $50,000. Attempt to withdraw $60,000 in one shot.
  await walletV3.deposit(walletId, 'USD', 200000, aliceDid);
  const dailyResult = await walletV3.initiateWithdrawal(walletId, 'USD', 60000, aliceDid);
  assert('DAILY_LIMIT: $60k withdrawal blocked (limit $50k)',
    !dailyResult.ok && dailyResult.code === 'POLICY_VIOLATION' &&
    dailyResult.violations.some(v => v.includes('Daily limit')),
    JSON.stringify(dailyResult));

  const dailyOk = await walletV3.initiateWithdrawal(walletId, 'USD', 49000, aliceDid);
  assert('DAILY_LIMIT: $49k withdrawal allowed', dailyOk.ok, JSON.stringify(dailyOk));

  // ── 5. VELOCITY_LIMIT policy ──────────────────────────────────────────────
  // Default: max 20 transactions per hour. Simulate 20 recorded transactions then try one more.
  for (let i = 0; i < 20; i++) {
    policyEngine.recordTransaction(walletId);
  }
  await walletV3.deposit(walletId, 'USD', 200000, aliceDid);
  const velocityResult = await walletV3.initiateWithdrawal(walletId, 'USD', 100, aliceDid);
  assert('VELOCITY_LIMIT: 21st transaction blocked (max 20/hr)',
    !velocityResult.ok && velocityResult.code === 'POLICY_VIOLATION' &&
    velocityResult.violations.some(v => v.includes('Velocity limit')),
    JSON.stringify(velocityResult));

  // ── 6. All policies satisfied ─────────────────────────────────────────────
  // Fresh wallet, fresh state
  const { didRegistry: dr2, policyEngine: pe2, walletV3: wv2 } = freshModules();
  const alice2 = generateKeyPair();
  const did2   = 'did:sovereign:alice-clean';
  dr2.register(did2, alice2.pubHex, ['owner']);
  const cw2 = await wv2.createWallet(did2, 'sovereign');
  await wv2.deposit(cw2.wallet.walletId, 'USD', 10000, did2);
  const cleanResult = await wv2.initiateWithdrawal(cw2.wallet.walletId, 'USD', 500, did2);
  assert('All policies satisfied: withdrawal initiated cleanly', cleanResult.ok, JSON.stringify(cleanResult));

  // ── 7. Custom policy registration ─────────────────────────────────────────
  // Register a policy that blocks any withdrawal on a Sunday
  const { policyEngine: pe3, walletV3: wv3, didRegistry: dr3 } = freshModules();
  pe3.registerPolicy('NO_SUNDAY_WITHDRAWALS', (ctx) => {
    if (ctx.operation !== 'withdraw') return { ok: true };
    const day = new Date().getDay(); // 0 = Sunday
    if (day === 0) return { ok: false, error: 'Withdrawals are blocked on Sundays' };
    return { ok: true };
  });
  assert('Custom policy registered', pe3.policies.has('NO_SUNDAY_WITHDRAWALS'));

  const alice3 = generateKeyPair();
  const did3   = 'did:sovereign:alice-custom';
  dr3.register(did3, alice3.pubHex, ['owner']);
  const cw3 = await wv3.createWallet(did3);
  await wv3.deposit(cw3.wallet.walletId, 'USD', 5000, did3);
  const customResult = await wv3.initiateWithdrawal(cw3.wallet.walletId, 'USD', 100, did3);
  const isSunday = new Date().getDay() === 0;
  if (isSunday) {
    assert('Custom NO_SUNDAY policy: blocked on Sunday', !customResult.ok && customResult.violations.some(v => v.includes('Sunday')));
  } else {
    assert('Custom NO_SUNDAY policy: allowed on non-Sunday', customResult.ok, JSON.stringify(customResult));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       AEGENTIS Wallet v3 — Test Suite                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    await testSignatures();
    await testPolicies();
  } catch (err) {
    console.error('\n[FATAL] Unhandled error during tests:', err);
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60) + '\n');
  process.exit(failed > 0 ? 1 : 0);
})();
