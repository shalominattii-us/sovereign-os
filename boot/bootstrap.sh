#!/bin/bash
# SOVEREIGN OS Bootstrap — Base system initialization
set -euo pipefail

echo "[+] SOVEREIGN OS Bootstrap"

apt-get update && apt-get install -y     curl wget git tmux htop ncdu     docker.io docker-compose     python3 python3-pip python3-venv     ufw fail2ban     nginx certbot

cat > /etc/docker/daemon.json <<'EOF'
{
  "userns-remap": "default",
  "live-restore": true,
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl restart docker

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
systemctl enable fail2ban
systemctl start fail2ban

echo "[+] Bootstrap complete. Reboot recommended."
