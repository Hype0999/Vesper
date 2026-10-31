#!/usr/bin/env bash
# ==============================================================================
# Vesper HDMI TV & CEC Remote Hardware Diagnostic Tool
# Real-World Hardware Verification on Raspberry Pi 4 (8GB)
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}${BOLD}"
echo "=================================================================="
echo "    📺 VESPER HDMI TV & CEC REMOTE HARDWARE DIAGNOSTICS          "
echo "=================================================================="
echo -e "${NC}"

# 1. Test HDMI Physical Link
echo -e "${BOLD}[1/4] Probing DRM sysfs for HDMI connection...${NC}"
FOUND_HDMI=0
for f in /sys/class/drm/card*-HDMI-A-*/status; do
  if [ -f "$f" ]; then
    PORT_NAME=$(echo "$f" | grep -oE 'HDMI-A-[0-9]')
    STATUS=$(cat "$f")
    if [ "$STATUS" = "connected" ]; then
      echo -e "${GREEN}[✓] Port $PORT_NAME is CONNECTED to TV!${NC}"
      FOUND_HDMI=1

      MODES_FILE=$(dirname "$f")/modes
      if [ -f "$MODES_FILE" ]; then
        RES=$(head -n 1 "$MODES_FILE" || echo "Unknown")
        echo -e "    • Resolution: ${GREEN}$RES${NC}"
      fi
    else
      echo -e "${YELLOW}[i] Port $PORT_NAME: disconnected${NC}"
    fi
  fi
done

if [ "$FOUND_HDMI" -eq 0 ]; then
  echo -e "${RED}[!] No HDMI display detected on micro-HDMI ports.${NC}"
  echo -e "    Ensure micro-HDMI cable is firmly inserted into HDMI0 (closest to USB-C power port)."
fi

# 2. Test Audio Sink
echo -e "\n${BOLD}[2/4] Testing Audio Pipeline...${NC}"
if command -v wpctl > /dev/null 2>&1; then
  echo -e "${GREEN}[✓] PipeWire audio daemon active.${NC}"
  wpctl status | grep -iE 'hdmi|sinks' -A 3 || true
elif command -v pactl > /dev/null 2>&1; then
  echo -e "${GREEN}[✓] PulseAudio daemon active.${NC}"
  pactl list sinks short || true
else
  echo -e "${YELLOW}[i] Testing ALSA hardware devices:${NC}"
  aplay -l || true
fi

# 3. Test HDMI-CEC Hardware
echo -e "\n${BOLD}[3/4] Testing HDMI-CEC Hardware (/dev/cec0)...${NC}"
if [ -e "/dev/cec0" ]; then
  echo -e "${GREEN}[✓] Native CEC hardware controller found: /dev/cec0${NC}"
else
  echo -e "${RED}[!] /dev/cec0 not found. Check /boot/config.txt or /boot/firmware/config.txt${NC}"
fi

if command -v cec-client > /dev/null 2>&1; then
  echo -e "${GREEN}[✓] cec-utils is installed.${NC}"
  echo -e "    Scanning CEC bus for connected TV..."
  echo 'scan' | cec-client -s -d 1 RPI || true
else
  echo -e "${YELLOW}[i] cec-client not installed. Install with: sudo apt-get install -y cec-utils${NC}"
fi

# 4. Interactive Remote Control Test
echo -e "\n${BOLD}[4/4] Interactive TV Remote Button Test${NC}"
echo -e "Press buttons on your physical TV Remote (Play, Pause, Up, Down, OK, Back)..."
echo -e "Press ${YELLOW}Ctrl+C${NC} anytime to stop the test.\n"

if command -v cec-client > /dev/null 2>&1 && [ -e "/dev/cec0" ]; then
  cec-client -d 1 -s RPI | grep -i --line-buffered "key pressed" || true
else
  echo -e "${YELLOW}[i] Skipping live remote button monitor (cec-client not available).${NC}"
fi

echo -e "\n${GREEN}[✓] Diagnostic complete.${NC}"
