#!/usr/bin/env bash
# ==============================================================================
# Vesper Sanctuary - Auto-Hotspot Failover Service for Raspberry Pi 4
# Solves the "Configured for Home Wi-Fi but Traveling on Train" Problem.
# 
# How it works:
# 1. On boot, waits up to 15 seconds to see if home Wi-Fi or Ethernet is reachable.
# 2. If connected to home Wi-Fi, it stays in client mode and exits cleanly.
# 3. If unreachable (e.g. on train, in car, or hotel), it automatically creates &
#    activates the "Vesper-Pi-Travel" Wi-Fi Hotspot on wlan0.
# 4. Phones/laptops can connect to "Vesper-Pi-Travel" (password: vesperpass)
#    and open http://10.42.0.1:3000 or http://vesper.local:3000.
# ==============================================================================

set -u

HOTSPOT_CON_NAME="Vesper-Hotspot"
HOTSPOT_SSID="Vesper-Pi-Travel"
HOTSPOT_PASS="vesperpass"
WLAN_IFACE="wlan0"
WAIT_TIMEOUT=12

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Vesper-AutoHotspot] $1"
}

# 1. Verify NetworkManager is active
if ! command -v nmcli >/dev/null 2>&1; then
  log "NetworkManager (nmcli) is not installed. Skipping auto-hotspot."
  exit 0
fi

# 2. Check if Ethernet or Wi-Fi is already connected
log "Checking for active Wi-Fi or Ethernet network connection (timeout: ${WAIT_TIMEOUT}s)..."

for i in $(seq 1 "$WAIT_TIMEOUT"); do
  # Check if we have an active default IPv4 route or active Wi-Fi client connection
  ACTIVE_WIFI=$(nmcli -t -f active,type dev wifi 2>/dev/null | grep '^yes' || true)
  ACTIVE_ROUTE=$(ip route show default 2>/dev/null | grep -E 'wlan|eth|en' || true)

  if [ -n "$ACTIVE_WIFI" ] || [ -n "$ACTIVE_ROUTE" ]; then
    CURRENT_IP=$(hostname -I | awk '{print $1}')
    log "[✓] Successfully connected to existing network (IP: $CURRENT_IP). AP mode not needed."
    exit 0
  fi
  sleep 1
done

log "[!] No existing Wi-Fi or LAN connection detected after ${WAIT_TIMEOUT}s (Traveling mode)."
log "Activating Vesper Wi-Fi Access Point..."

# 3. Check if wlan interface exists
if ! ip link show "$WLAN_IFACE" >/dev/null 2>&1; then
  # Fallback: find any wlan or wl interface
  ALT_IFACE=$(ip -o link show | awk -F': ' '{print $2}' | grep -E '^wl' | head -n1 || true)
  if [ -n "$ALT_IFACE" ]; then
    WLAN_IFACE="$ALT_IFACE"
    log "Using Wi-Fi interface: $WLAN_IFACE"
  else
    log "[ERROR] No Wi-Fi interface found. Cannot start hotspot."
    exit 1
  fi
fi

# Unblock Wi-Fi via rfkill if soft-blocked
if command -v rfkill >/dev/null 2>&1; then
  rfkill unblock wifi 2>/dev/null || true
fi

# 4. Create or update NetworkManager Hotspot connection profile
if ! nmcli -t -f NAME con show | grep -Fxq "$HOTSPOT_CON_NAME"; then
  log "Creating new NetworkManager connection profile: $HOTSPOT_CON_NAME..."
  nmcli con add type wifi ifname "$WLAN_IFACE" con-name "$HOTSPOT_CON_NAME" autoconnect no ssid "$HOTSPOT_SSID" >/dev/null
  nmcli con modify "$HOTSPOT_CON_NAME" 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared >/dev/null
  nmcli con modify "$HOTSPOT_CON_NAME" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$HOTSPOT_PASS" >/dev/null
else
  log "Existing hotspot connection profile found: $HOTSPOT_CON_NAME"
fi

# 5. Bring up Hotspot
log "Bringing up $HOTSPOT_CON_NAME ($HOTSPOT_SSID)..."
if nmcli con up "$HOTSPOT_CON_NAME"; then
  log "=================================================================="
  log " [✓] VESPER WI-FI HOTSPOT IS LIVE AND BROADCASTING!"
  log " SSID:     $HOTSPOT_SSID"
  log " Password: $HOTSPOT_PASS"
  log " URL:      http://10.42.0.1:3000 or http://vesper.local:3000"
  log "=================================================================="
else
  log "[WARNING] Direct connection up failed. Trying dev wifi hotspot fallback..."
  nmcli dev wifi hotspot ifname "$WLAN_IFACE" ssid "$HOTSPOT_SSID" password "$HOTSPOT_PASS" || {
    log "[ERROR] Failed to start Wi-Fi hotspot on $WLAN_IFACE."
    exit 1
  }
fi

exit 0
