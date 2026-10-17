#!/usr/bin/env bash
# ==============================================================================
# TravelHub Pro - Direct Foreground Start Script
# Runs the server with live console output
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "Starting TravelHub Pro..."
npm run start
