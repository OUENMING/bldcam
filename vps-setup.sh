#!/bin/bash
# vps-setup.sh — runs ON the VPS after rsync
# Triggered by deploy.sh via nohup, survives SSH disconnect
set -e

cd /home/bldcam

# ── 1. Install system fonts for share card rendering ──
sudo apt-get update -qq
sudo apt-get install -y -qq fonts-inter 2>/dev/null || true

# ── 2. Fix DATABASE_URL to absolute path ──────────
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=file:/home/bldcam/dev.db|" .env.production

# ── 2. Reinstall sharp for Linux ──────────────────
rm -rf node_modules/sharp
npm install --force --platform=linux --arch=x64 sharp@0.35.1

# ── 3. Replace macOS sharp in Next.js cache ────────
SHARP_CACHE=$(ls -d .next/node_modules/sharp-* 2>/dev/null | head -1)
if [ -n "$SHARP_CACHE" ]; then
  rm -rf "$SHARP_CACHE/build" "$SHARP_CACHE/vendor" "$SHARP_CACHE/install" 2>/dev/null
  cp -r node_modules/sharp/build "$SHARP_CACHE/" 2>/dev/null || true
  cp -r node_modules/sharp/vendor "$SHARP_CACHE/" 2>/dev/null || true
  cp -r node_modules/sharp/install "$SHARP_CACHE/" 2>/dev/null || true
fi

# ── 4. Restart PM2 ────────────────────────────────
pm2 delete bldcam 2>/dev/null || true
pm2 start server.js --name bldcam
pm2 save
