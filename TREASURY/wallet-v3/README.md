# AEGENTIS Wallet v3

**Sovereign identity-linked wallet with DID-based signing, policy engine, and XVLSO cross-vector ledger sync.**

## What's New in v3

| Feature | v2 | v3 |
|---------|----|----|
| Full REST API | ✅ | ✅ |
| Kernel event-bus integration | ✅ | ✅ |
| Multi-asset portfolio | ✅ | ✅ |
| Intra-treasury transfers | ✅ | ✅ |
| Transaction expiry & rejection | ✅ | ✅ |
| **DID-bound wallet creation** | ❌ | ✅ |
| **Ed25519 cryptographic signature verification** | ❌ | ✅ |
| **Signer delegation / revocation** | ❌ | ✅ |
| **Policy engine** (FREEZE, ROLE_CHECK, DAILY_LIMIT, VELOCITY, WHITELIST) | ❌ | ✅ |
| **Wallet freeze / unfreeze** | ❌ | ✅ |
| **XVLSO cross-vector ledger sync** | ❌ | ✅ |
| **Audit log for policy violations** | ❌ | ✅ |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Wallet v3 Service                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ DID Registry │  │Policy Engine │  │ WalletV3     │  │
│  │ (Ed25519)    │  │ (5 policies) │  │ Runtime      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┴────────────────►│           │
│                                             │           │
│                              ┌──────────────▼────────┐  │
│                              │  Treasury Ledger      │  │
│                              │  (append-only JSONL)  │  │
│                              └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ Kernel Event Bus
                  WALLET_CREATED, DEPOSIT_RECORDED,
                  WITHDRAWAL_*, TRANSFER_INTENT,
                  BALANCE_SNAPSHOT, XVLSO_SYNC,
                  POLICY_VIOLATION, SIGNER_*
```

## Policy Engine

| Policy | Operation | Description |
|--------|-----------|-------------|
| `FREEZE` | withdraw, transfer | Blocked if wallet is frozen |
| `ROLE_CHECK` | withdraw, transfer | Actor DID must hold `owner` or `signer` role |
| `ASSET_WHITELIST` | withdraw, transfer | Only USD, BTC, ETH, SOV by default |
| `DAILY_LIMIT` | withdraw, transfer | Per-asset 24-hour rolling cap |
| `VELOCITY_LIMIT` | withdraw, transfer | Max 20 transactions per hour |

## Signature Flow

```
1. Client calls POST /v3/wallets/:id/withdraw
   → Returns txId + required_signatures

2. Each authorised signer:
   a. Signs the txId string with their Ed25519 private key
   b. Calls POST /v3/transactions/:txId/sign
      { signerDid, signature (hex) }
   → Signature verified against DID registry public key
   → When threshold met: WITHDRAWAL_APPROVED emitted

3. XVLSO sync runs every 60s, emitting cross-wallet snapshots
   to the Kernel for cadet monitoring
```

## Endpoints (prefix: `/v3`)

### DID
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v3/dids` | Register DID + Ed25519 public key |
| `GET`  | `/v3/dids/:did` | Get DID document |
| `DELETE` | `/v3/dids/:did` | Revoke DID |

### Wallets
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v3/wallets` | Create wallet (DID required) |
| `GET`  | `/v3/wallets/:id` | Get wallet |
| `POST` | `/v3/wallets/:id/deposit` | Deposit asset |
| `POST` | `/v3/wallets/:id/withdraw` | Initiate withdrawal |
| `POST` | `/v3/wallets/:id/transfer` | Transfer to another wallet |
| `GET`  | `/v3/wallets/:id/balance` | Current balance |
| `POST` | `/v3/wallets/:id/snapshot` | Emit XVLSO snapshot |
| `GET`  | `/v3/wallets/:id/history` | Ledger history |
| `POST` | `/v3/wallets/:id/freeze` | Freeze wallet |
| `POST` | `/v3/wallets/:id/unfreeze` | Unfreeze wallet |
| `POST` | `/v3/wallets/:id/signers` | Delegate signer DID |
| `DELETE` | `/v3/wallets/:id/signers/:did` | Revoke signer DID |

### Transactions
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v3/transactions/:txId/sign` | Sign with DID + Ed25519 signature |
| `POST` | `/v3/transactions/:txId/reject` | Reject transaction |
| `GET`  | `/v3/transactions/:txId` | Get transaction |

### Policy
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/v3/policy/config` | View current policy configuration |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WALLET_V3_PORT` | `8084` | HTTP port |
| `KERNEL_EVENT_BUS_URL` | `http://kernel-event-bus:8080/intent` | Kernel endpoint |
| `TX_TTL_MS` | `300000` | Transaction expiry (ms) |
| `XVLSO_INTERVAL_MS` | `60000` | Cross-vector sync interval (ms) |
