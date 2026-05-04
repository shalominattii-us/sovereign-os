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
