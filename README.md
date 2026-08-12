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

The canonical Foundry runtime now lives in the dedicated [`shalominattii-us/Foundry`](https://github.com/shalominattii-us/Foundry) repository. This repository owns the Cybercore domain engine under `CYBERCORE/opportunity_intake`, Kernel event integration, and a manifest-validated compatibility bridge under `FOUNDRY/opportunity-intelligence`.[1] [2] [3]

| Layer | Responsibility |
|---|---|
| Dedicated Foundry repository | Native Python intelligence plugins, maturity output engine, immutable run artifacts, and execution lifecycle |
| Sovereign Foundry bridge | Backward-compatible Node composition, Kernel publication, local output index, and AEGENTIS delegation |
| Cybercore | Canonical records, evidence, scores, routes, lifecycle, events, and authorization |
| Kernel | Policy validation, persistence, state projection, and replay isolation |

```bash
npm test --prefix CYBERCORE/opportunity_intake
npm test --prefix FOUNDRY/opportunity-intelligence
node FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js run
```

Both implementations execute no automatic external action and no automatic Treasury Labs handoff. Ready records stop at a human-review boundary.

## References

[1]: https://github.com/shalominattii-us/Foundry/tree/12d59571c12cc38dbe723549d119f48db2f269d0 "Canonical Foundry Cybercore Opportunity Intelligence release commit"
[2]: FOUNDRY/opportunity-intelligence/README.md "Sovereign Foundry compatibility operator guide"
[3]: CYBERCORE/opportunity_intake/README.md "Cybercore Opportunity Intelligence operator guide"
