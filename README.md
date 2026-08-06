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

## Foundry and Cybercore Opportunity Intelligence

The repository includes a manifest-validated Foundry composition under `FOUNDRY/opportunity-intelligence` and the canonical domain engine under `CYBERCORE/opportunity_intake`. Together they provide opportunity intake, authoritative source verification, deterministic strategic scoring, commercialization routing, maturity outputs, append-only events, and a strict human authorization boundary.[1] [2]

| Layer | Responsibility |
|---|---|
| Foundry | Plugin composition, executable hooks, maturity bundles, output index, and run evidence |
| Cybercore | Canonical records, evidence, scores, routes, lifecycle, events, and authorization |
| Kernel | Policy validation, persistence, state projection, and replay isolation |

```bash
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix FOUNDRY/opportunity-intelligence
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run
```

The Foundry output engine executes no external action and no automatic Treasury Labs handoff. Ready records stop at `HUMAN_REVIEW_REQUIRED`.

## References

[1]: FOUNDRY/opportunity-intelligence/README.md "Foundry Opportunity Intelligence operator guide"
[2]: CYBERCORE/opportunity_intake/README.md "Cybercore Opportunity Intelligence operator guide"
