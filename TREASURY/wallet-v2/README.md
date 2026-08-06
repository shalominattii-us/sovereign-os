# AEGENTIS Wallet v2

**Multi-asset wallet with Kernel event-bus integration.**

## What's New in v2

| Feature | v1 | v2 |
|---------|----|----|
| Full REST API | ✅ | ✅ |
| Kernel event-bus integration | ❌ | ✅ |
| Canonical treasury event types | ❌ | ✅ |
| In-memory asset portfolio tracking | ❌ | ✅ |
| Intra-treasury wallet transfers | ❌ | ✅ |
| Balance snapshot (emitted to Kernel) | ❌ | ✅ |
| Transaction expiry (TTL) | ❌ | ✅ |
| Transaction rejection | ❌ | ✅ |
| Structured error codes | ❌ | ✅ |
| Insufficient-funds guard | ❌ | ✅ |

## Canonical Event Types Emitted

| Event | Trigger |
|-------|---------|
| `WALLET_CREATED` | New wallet created |
| `DEPOSIT_RECORDED` | Asset deposited |
| `WITHDRAWAL_INITIATED` | Withdrawal started |
| `WITHDRAWAL_APPROVED` | All signatures collected |
| `WITHDRAWAL_REJECTED` | Explicitly rejected |
| `WITHDRAWAL_EXPIRED` | TTL elapsed without approval |
| `TRANSFER_INTENT` | Intra-treasury transfer executed |
| `BALANCE_SNAPSHOT` | Snapshot requested |

## Endpoints (prefix: `/v2`)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service health |
| `POST` | `/v2/wallets` | Create wallet |
| `GET`  | `/v2/wallets/:id` | Get wallet |
| `POST` | `/v2/wallets/:id/deposit` | Deposit asset |
| `POST` | `/v2/wallets/:id/withdraw` | Initiate withdrawal |
| `POST` | `/v2/wallets/:id/transfer` | Transfer to another wallet |
| `GET`  | `/v2/wallets/:id/balance` | Current balance |
| `POST` | `/v2/wallets/:id/snapshot` | Emit balance snapshot |
| `GET`  | `/v2/wallets/:id/history` | Ledger history |
| `POST` | `/v2/transactions/:txId/sign` | Sign transaction |
| `POST` | `/v2/transactions/:txId/reject` | Reject transaction |
| `GET`  | `/v2/transactions/:txId` | Get transaction |
| `GET`  | `/v2/assets` | List assets |
| `POST` | `/v2/assets` | Register asset |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WALLET_V2_PORT` | `8083` | HTTP port |
| `KERNEL_EVENT_BUS_URL` | `http://kernel-event-bus:8080/intent` | Kernel endpoint |
| `TX_TTL_MS` | `300000` | Transaction expiry (ms) |

## Quick Start

```bash
# Create a wallet
curl -X POST http://localhost:8083/v2/wallets \
  -H "Content-Type: application/json" \
  -d '{"ownerId":"did:sovereign:alice","type":"sovereign"}'

# Deposit 5000 ETH
curl -X POST http://localhost:8083/v2/wallets/<walletId>/deposit \
  -H "Content-Type: application/json" \
  -d '{"asset":"ETH","amount":5000,"actor":"did:sovereign:alice"}'

# Transfer 1000 ETH to another wallet
curl -X POST http://localhost:8083/v2/wallets/<fromId>/transfer \
  -H "Content-Type: application/json" \
  -d '{"toWalletId":"<toId>","asset":"ETH","amount":1000,"actor":"did:sovereign:alice"}'
```
