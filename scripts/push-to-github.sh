#!/usr/bin/env bash
# ==============================================================================
# Vesper Sanctuary - 1-Click GitHub Push Script (Linux/macOS)
# Author: Kartikeya Saini
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "===================================================================="
echo "      🚀 VESPER SANCTUARY - GITHUB PUSH TOOL"
echo "      Author: Kartikeya Saini"
echo "===================================================================="
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed. Please install git."
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "[i] Initializing Git repository..."
  git init
  git branch -M main
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  read -r -p "Enter GitHub Repository URL (e.g. https://github.com/YourUsername/vesper.git): " REPO_URL
  git remote add origin "$REPO_URL"
  echo "[✓] Remote origin set to $REPO_URL"
fi

echo "[i] Staging project files (strictly excluding personal media & .env)..."
git add .

echo "[i] Committing files..."
git commit -m "feat: Vesper Sanctuary v1.0.0 - Self-Hosted Travel Media Hub by Kartikeya Saini" || true

echo "[i] Pushing to GitHub main branch..."
git push -u origin main

echo ""
echo "===================================================================="
echo "  🎉 SUCCESS! Vesper Sanctuary is now live on GitHub!"
echo "===================================================================="
