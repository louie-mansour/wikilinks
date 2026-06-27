#!/bin/bash
set -euo pipefail

# Run as root on a fresh Hetzner Ubuntu server.
# Called by: make server-setup

DEPLOY_PUBKEY=$(cat /opt/wikihop/deploy/wikihop_deploy.pub)

echo "==> Creating system user and directories"
useradd -r -s /bin/false -d /opt/wikihop wikihop 2>/dev/null || true
mkdir -p /opt/wikihop/{bin,dist,data}
chown -R wikihop:wikihop /opt/wikihop

echo "==> Creating deploy user"
useradd -m -s /bin/bash deploy 2>/dev/null || true
mkdir -p /home/deploy/.ssh
echo "${DEPLOY_PUBKEY}" >> /home/deploy/.ssh/authorized_keys
sort -u /home/deploy/.ssh/authorized_keys -o /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chown deploy:wikihop /opt/wikihop/bin /opt/wikihop/dist
chmod 775 /opt/wikihop/bin /opt/wikihop/dist
echo 'deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart wikihop, /bin/systemctl status wikihop' \
  > /etc/sudoers.d/wikihop-deploy
chmod 440 /etc/sudoers.d/wikihop-deploy

echo "==> Installing Caddy"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

echo "==> Installing Caddyfile and systemd service"
cp /opt/wikihop/deploy/Caddyfile /etc/caddy/Caddyfile
cp /opt/wikihop/deploy/wikihop.service /etc/systemd/system/wikihop.service
systemctl daemon-reload
systemctl enable caddy wikihop

echo "==> Configuring firewall"
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "Server setup complete. Two manual steps remain:"
echo ""
echo "  1. Upload Cloudflare origin certificate:"
echo "     nano /etc/caddy/cf-origin.pem   # paste cert"
echo "     nano /etc/caddy/cf-origin.key   # paste key"
echo "     chmod 600 /etc/caddy/cf-origin.key"
echo ""
echo "  2. Create secrets file:"
echo "     cat > /opt/wikihop/.env << 'EOF'"
echo "     POSTHOG_API_KEY=your_key_here"
echo "     POSTHOG_HOST=https://us.i.posthog.com"
echo "     APP_ENV=production"
echo "     EOF"
echo "     chmod 600 /opt/wikihop/.env && chown wikihop:wikihop /opt/wikihop/.env"
echo ""
echo "  Then run: make upload-data && systemctl restart caddy wikihop"
