# AEGENTIX SOVEREIGN SWARM MANIFEST
**Generated**: 2026-07-10  
**Status**: OPERATIONAL  

---

## Constellation Overview

The Sovereign OS swarm is a fully integrated constellation of autonomous agents, services, and external integrations operating under the AEGENTIX CYBERNETICS framework.

---

## Active Integrations

| Integration | Status | Details |
|-------------|--------|---------|
| **Moltbook** | REGISTERED | Agent: `aegentix-sovereign` — Claim URL sent to human |
| **Shopify AEGENTIS-X** | ACTIVE | 29 products live at `admin.shopify.com/store/aegentis-x` |
| **Coinbase Treasury** | CONFIGURED | Read-only key ID: `13ca3aa9-d6eb-4257-98d8-f94b3a144904` |
| **WorldMonitor CI/CD** | FIXED | `diagnostics-deploy.yml` now triggers on `diagnostics/**` branches |
| **GitHub Actions** | ACTIVE | `sovereign-ci.yml` validates all services on every push |
| **XRPL** | CONFIGURED | Endpoint: `wss://xrplcluster.com` |

---

## Service Map

```
KERNEL/
  event-bus          → Port 8080  — Central event router (all services connect here)
  identity-os        → Port 8081  — JWT identity and auth
  agent-runtime      → Port 8082  — Jarvis orchestrator binding
  moltbook/          → Heartbeat  — Social agent network (aegentix-sovereign)
  memory-graph/      → Internal   — GEN-01 arena core

DATA/
  vector-memory      → Port 8083  — Vector store and knowledge graph

CLOUD/
  event-streaming    → Port 8084  — Real-time event stream

SECURITY/
  monitoring         → Port 9000  — Orbital Observer dashboard
  threat-intelligence → Internal  — Threat monitor loop

XR/
  quest              → Port 7778  — AEGENTIS-X Quest VR backend
  spatial-command-center → Internal — VR command center

TREASURY/
  shopify-integration → External  — AEGENTIS-X Shopify store sync
  coinbase-integration → External — Read-only portfolio monitoring
  asset-registry      → Internal  — On-chain asset registry
  treasury-ledger     → Internal  — Ledger service
  wallet-runtime      → Internal  — XRPL wallet runtime
  autonomous-agents   → Internal  — Treasury AI agents

AI/
  autonomous-agents   → Internal  — Base agent framework
  multi-llm-runtime   → Internal  — Multi-model LLM router

DEVELOPER/
  cli/aegentis.js     → CLI tool  — AEGENTIS command-line interface
  plugin-registry     → Internal  — Plugin management

SECURITY/
  zero-trust          → Middleware — Zero-trust request validation
```

---

## Moltbook Agent

- **Name**: `aegentix-sovereign`
- **Profile**: https://www.moltbook.com/u/aegentix-sovereign
- **Claim**: https://www.moltbook.com/claim/moltbook_claim_4AhfErb0iRgLlIQixay42OkzRo0mrbHr
- **Verification Code**: `rocky-86TN`
- **Heartbeat**: `KERNEL/moltbook/heartbeat.mjs` (runs every 30 min)

---

## CI/CD

| Repo | Workflow | Status |
|------|----------|--------|
| `shalominattii-us/sovereign-os` | `sovereign-ci.yml` | Active — validates on every push |
| `shalominattii-us/worldmonitor` | `diagnostics-deploy.yml` | Fixed — now triggers on `diagnostics/**` branches |

---

## Quick Start

```bash
# 1. Copy env
cp .env.example .env
# Edit .env — fill in SHOPIFY_ACCESS_TOKEN, COINBASE_API_SECRET, SOVEREIGN_JWT_SECRET

# 2. Launch full constellation
docker compose up -d

# 3. Run Moltbook heartbeat
MOLTBOOK_API_KEY=moltbook_sk_rtaS_Ay6G5K7SzCOPkxK34T_1mDBzDDA \
  node KERNEL/moltbook/heartbeat.mjs

# 4. Check status
docker compose ps
curl http://localhost:8080/health
```
