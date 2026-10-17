#!/usr/bin/env bash
# ==============================================================================
# TravelHub Pro - 1-Click Raspberry Pi 4 (8GB) Auto-Installer
# For Raspberry Pi OS (Bookworm / 64-bit Debian)
# Sets up mDNS (.local), Auto-Boot systemd service, Wi-Fi Manager & 4K Streaming
# ==============================================================================

set -euo pipefail

# ANSI Color formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}"
echo "=================================================================="
echo "      🚀 TRAVELHUB PRO - RASPBERRY PI 4 SETUP & DEPLOYMENT       "
echo "      Zero-Transcode 4K Travel Media Hub & Wi-Fi Hotspot        "
echo "=================================================================="
echo -e "${NC}"

# Check for root / sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[!] Please run with sudo: sudo bash scripts/install-pi.sh${NC}"
  exit 1
fi

REAL_USER="${SUDO_USER:-$USER}"
USER_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${GREEN}[✓] Target installation directory:${NC} $SCRIPT_DIR"
echo -e "${GREEN}[✓] Executing as user:${NC} $REAL_USER (Home: $USER_HOME)"

# 1. Update package lists and install essential system dependencies
echo -e "\n${BLUE}[1/6] Installing system dependencies (Avahi mDNS, NetworkManager, build-essential)...${NC}"
apt-get update -qq
apt-get install -y -qq \
  curl \
  wget \
  git \
  build-essential \
  avahi-daemon \
  avahi-utils \
  network-manager \
  libnss-mdns \
  qrencode > /dev/null

# Enable & restart Avahi for .local mDNS broadcast
systemctl enable avahi-daemon
systemctl restart avahi-daemon

# 2. Check or Install Node.js (LTS v20+)
echo -e "\n${BLUE}[2/6] Checking Node.js runtime...${NC}"
NODE_OK=0
if command -v node > /dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    NODE_OK=1
    echo -e "${GREEN}[✓] Node.js $(node -v) is already installed.${NC}"
  fi
fi

if [ "$NODE_OK" -eq 0 ]; then
  echo -e "${YELLOW}[i] Node.js 20+ not found. Installing NodeSource Node.js 20 LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
  echo -e "${GREEN}[✓] Node.js installed: $(node -v) with npm $(npm -v)${NC}"
fi

# 3. Environment Setup & Storage directory
echo -e "\n${BLUE}[3/6] Setting up environment configuration & storage...${NC}"
cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    cat << 'EOF' > .env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
APP_NAME=TravelHub
STORAGE_DIR=./storage
CORS_ORIGIN=*
EOF
  fi
fi

# Ensure storage directories exist and have proper permissions
mkdir -p "$SCRIPT_DIR/storage/originals"
mkdir -p "$SCRIPT_DIR/storage/thumbnails"
mkdir -p "$SCRIPT_DIR/storage/vault"
chown -R "$REAL_USER:$REAL_USER" "$SCRIPT_DIR"

# 4. Install npm dependencies & build full production bundle
echo -e "\n${BLUE}[4/6] Installing project packages and compiling client & server bundles...${NC}"
sudo -u "$REAL_USER" npm install --no-audit --no-fund
sudo -u "$REAL_USER" npm run build

# 5. Install Vesper Auto-Hotspot Failover Service (Solves Train Travel / Missing Home Wi-Fi)
echo -e "\n${BLUE}[5/7] Installing Vesper Auto-Hotspot Travel Failover service...${NC}"
cp "$SCRIPT_DIR/scripts/vesper-autohotspot.sh" /usr/local/bin/vesper-autohotspot.sh
chmod +x /usr/local/bin/vesper-autohotspot.sh

cp "$SCRIPT_DIR/scripts/vesper-autohotspot.service" /etc/systemd/system/vesper-autohotspot.service
chmod 644 /etc/systemd/system/vesper-autohotspot.service

# 6. Create Vesper Systemd Service for Auto-Start on Boot with Zero Failure
echo -e "\n${BLUE}[6/7] Creating systemd service for Vesper Sanctuary core auto-start...${NC}"

SERVICE_FILE="/etc/systemd/system/vesper.service"
cat << EOF > "$SERVICE_FILE"
[Unit]
Description=Vesper Personal Media Sanctuary Core Server
After=network.target avahi-daemon.service NetworkManager.service vesper-autohotspot.service
Wants=network.target
Documentation=https://github.com/vesper-sanctuary

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$SCRIPT_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0
ExecStart=$(which npm) run start
Restart=always
RestartSec=3
KillMode=mixed
TimeoutStopSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# Ensure backward compatibility alias for travelhub.service
ln -sf /etc/systemd/system/vesper.service /etc/systemd/system/travelhub.service

# Reload and enable services
systemctl daemon-reload
systemctl enable vesper-autohotspot.service
systemctl enable vesper.service
systemctl restart vesper.service

# 7. Verify Service Status and Detect IP
echo -e "\n${BLUE}[7/7] Verifying service status...${NC}"
sleep 2

if systemctl is-active --quiet vesper.service; then
  echo -e "${GREEN}${BOLD}[✓] SUCCESS! Vesper Sanctuary is running in the background.${NC}"
else
  echo -e "${RED}[!] Service failed to start immediately. Check: journalctl -u vesper.service -n 20${NC}"
fi

# Extract primary IP addresses
LOCAL_IPS=$(hostname -I || echo "127.0.0.1")
HOSTNAME=$(hostname)

echo -e "\n${GREEN}${BOLD}=================================================================="
echo "          🎉 VESPER SANCTUARY IS READY FOR YOUR TRIP!            "
echo "==================================================================${NC}"
echo -e "Seamless Phone Connection on Trains or at Home:\n"
echo -e "1. ${BOLD}On the Train (No Home Wi-Fi):${NC}"
echo -e "   • Your Pi will automatically switch to ${GREEN}AP / Hotspot Mode${NC} within 12s!"
echo -e "   • Connect your phone's Wi-Fi to: ${YELLOW}Vesper-Pi-Travel${NC}"
echo -e "   • Password:                      ${YELLOW}vesperpass${NC}"
echo -e "   • Open in browser:               ${GREEN}http://10.42.0.1:3000${NC} or ${GREEN}http://vesper.local:3000${NC}"
echo ""
echo -e "2. ${BOLD}At Home (Existing Wi-Fi):${NC}"
echo -e "   • Automatically connects to your pre-configured home Wi-Fi."
echo -e "   • Open in browser:               ${GREEN}http://${HOSTNAME}.local:3000${NC}"
for ip in $LOCAL_IPS; do
  echo -e "   • Direct IP:                     ${GREEN}http://${ip}:3000${NC}"
done
echo ""
echo -e "${YELLOW}Quick Travel Tips for the Train:${NC}"
echo -e " • Plug the Pi into any 5V/3A USB-C power bank or train outlet."
echo -e " • Zero-transcode direct streaming guarantees ice-cool Pi thermals and zero CPU throttling."
echo -e " • All Private Vault media is encrypted with AES-256-CTR at rest."
echo -e " • Service Management:"
echo -e "     - View logs:   ${BOLD}journalctl -u vesper.service -f${NC}"
echo -e "     - Restart:     ${BOLD}sudo systemctl restart vesper${NC}"
echo -e "     - Force AP:    ${BOLD}sudo /usr/local/bin/vesper-autohotspot.sh${NC}"
echo "=================================================================="
