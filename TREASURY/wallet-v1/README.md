# AEGENTIS Wallet v1

**Full REST API service** — exposes every wallet operation over HTTP.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service health & stats |
| `POST` | `/wallets` | Create a new wallet |
| `GET`  | `/wallets/:walletId` | Get wallet metadata |
| `POST` | `/wallets/:walletId/deposit` | Deposit an asset |
| `POST` | `/wallets/:walletId/withdraw` | Initiate a multi-sig withdrawal |
| `GET`  | `/wallets/:walletId/balance` | Get current balances |
| `GET`  | `/wallets/:walletId/history` | Full ledger history |
| `POST` | `/transactions/:txId/sign` | Sign a pending transaction |
| `GET`  | `/transactions/:txId` | Get a pending transaction |
| `GET`  | `/assets` | List registered assets |
| `POST` | `/assets` | Register a new asset |

## Multi-Signature Thresholds

| Value (USD) | Required Signatures |
|-------------|---------------------|
| ≤ $1,000    | 1 |
| ≤ $10,000   | 2 |
| ≤ $100,000  | 3 |
| > $100,000  | 4 |

## Quick Start

```bash
# Create a wallet
curl -X POST http://localhost:8082/wallets \
  -H "Content-Type: application/json" \
  -d '{"ownerId":"did:sovereign:alice"}'

# Deposit 500 USD
curl -X POST http://localhost:8082/wallets/<walletId>/deposit \
  -H "Content-Type: application/json" \
  -d '{"asset":"USD","amount":500,"actor":"did:sovereign:alice"}'

# Check balance
curl http://localhost:8082/wallets/<walletId>/balance
```

## Port

Default: `8082` (override with `WALLET_V1_PORT` env var)
