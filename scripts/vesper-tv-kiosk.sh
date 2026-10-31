#!/usr/bin/env bash
# ==============================================================================
# Vesper TV Kiosk Display Controller for Raspberry Pi 4 (8GB)
# Automatically launches full-screen 10-foot cinema UI on connected HDMI TV
# Supports Wayland (Wayfire/Labwc) and X11 display servers
# ==============================================================================

set -euo pipefail

TARGET_URL="http://localhost:3000/tv"
ACTION="${1:-start}"

# Detect active Wayland or X11 display
export DISPLAY="${DISPLAY:-:0}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

is_hdmi_connected() {
  for f in /sys/class/drm/card*-HDMI-A-*/status; do
    if [ -f "$f" ] && grep -q "connected" "$f"; then
      return 0
    fi
  done
  return 1
}

start_kiosk() {
  echo "[VESPER TV] Checking HDMI status..."
  if ! is_hdmi_connected; then
    echo "[VESPER TV] No HDMI TV detected on micro-HDMI ports. Kiosk will stay in standby."
    exit 0
  fi

  echo "[VESPER TV] HDMI TV detected. Launching 10-foot cinema kiosk at $TARGET_URL..."

  # Disable screen sleep, blanking and DPMS if running X11
  if command -v xset > /dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    xset s off 2>/dev/null || true
    xset -dpms 2>/dev/null || true
    xset s noblank 2>/dev/null || true
  fi

  # Route audio to HDMI
  if command -v wpctl > /dev/null 2>&1; then
    HDMI_SINK=$(wpctl status | grep -iE 'hdmi|digital audio' | grep -oE '[0-9]+' | head -n 1 || true)
    if [ -n "$HDMI_SINK" ]; then
      wpctl set-default "$HDMI_SINK" 2>/dev/null || true
    fi
  elif command -v pactl > /dev/null 2>&1; then
    HDMI_SINK=$(pactl list sinks short | grep -i 'hdmi' | cut -f2 | head -n 1 || true)
    if [ -n "$HDMI_SINK" ]; then
      pactl set-default-sink "$HDMI_SINK" 2>/dev/null || true
    fi
  elif command -v amixer > /dev/null 2>&1; then
    amixer -c 0 cset numid=3 2 2>/dev/null || true
  fi

  # Launch Chromium with hardware video decode, fullscreen kiosk, and zero-click autoplay
  CHROMIUM_BIN=""
  if command -v chromium-browser > /dev/null 2>&1; then
    CHROMIUM_BIN="chromium-browser"
  elif command -v chromium > /dev/null 2>&1; then
    CHROMIUM_BIN="chromium"
  elif command -v google-chrome > /dev/null 2>&1; then
    CHROMIUM_BIN="google-chrome"
  fi

  if [ -n "$CHROMIUM_BIN" ]; then
    # Kill any existing kiosk instances
    pkill -f "vesper-tv-kiosk" 2>/dev/null || true

    nohup "$CHROMIUM_BIN" \
      --kiosk \
      --noerrdialogs \
      --disable-infobars \
      --no-first-run \
      --disable-features=TranslateUI \
      --disk-cache-dir=/tmp/vesper-tv-cache \
      --autoplay-policy=no-user-gesture-required \
      --enable-features=OverlayScrollbar \
      --check-for-update-interval=31536000 \
      "$TARGET_URL" > /dev/null 2>&1 &

    echo "[VESPER TV] Kiosk launched successfully."
  else
    echo "[VESPER TV] Notice: Chromium not found. Please install: sudo apt-get install -y chromium-browser"
  fi
}

stop_kiosk() {
  echo "[VESPER TV] Stopping TV Kiosk display..."
  pkill -f "$TARGET_URL" 2>/dev/null || true
  pkill -f "chromium-browser --kiosk" 2>/dev/null || true
}

case "$ACTION" in
  start)
    start_kiosk
    ;;
  stop)
    stop_kiosk
    ;;
  restart)
    stop_kiosk
    sleep 1
    start_kiosk
    ;;
  status)
    if is_hdmi_connected; then
      echo "[VESPER TV] HDMI TV is CONNECTED."
    else
      echo "[VESPER TV] HDMI TV is DISCONNECTED."
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac

