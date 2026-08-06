# sovereign-os

Base operating system bootstrap, kernel hardening, and init services for SOVEREIGN nodes.

## Bootstrap

```bash
sudo bash boot/bootstrap.sh
```

## Kernel Hardening

```bash
sudo cp kernel/sysctl-harden.conf /etc/sysctl.d/99-sovereign.conf
sudo sysctl -p /etc/sysctl.d/99-sovereign.conf
```

## Service Install

```bash
sudo cp init/sovereind.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sovereind
```

## Cybercore Opportunity Intake

The repository includes a deterministic, event-first opportunity intelligence pipeline under `CYBERCORE/opportunity_intake`. It normalizes and deduplicates opportunity signals, binds records to authoritative source evidence, computes versioned strategic scores, identifies commercialization paths, and blocks every Treasury Labs handoff or external action behind a scoped human authorization artifact.

```bash
npm test --prefix CYBERCORE/opportunity_intake
node CYBERCORE/opportunity_intake/bin/aegentix_cybercore_ingest.js ingest \
  --source opportunity_intake \
  --batch 2026-08-06 \
  --mode normalize_validate \
  --authorization human_required
node CYBERCORE/opportunity_intake/bin/aegentix_cybercore_ingest.js pipeline
```

See [`CYBERCORE/opportunity_intake/README.md`](CYBERCORE/opportunity_intake/README.md) for the operator workflow and verification procedure.
