#!/bin/bash
# vps-setup.sh — runs ON the VPS after rsync
# Triggered by deploy.sh via nohup, survives SSH disconnect
# NOTE: No `set -e`. Each step handles its own errors
#       so a failure doesn't leave the app offline.

cd /home/bldcam

# ── 1. Install system fonts (optional) ──────────
sudo apt-get install -y -qq fonts-inter 2>/dev/null || true

# ── 2. Fix DATABASE_URL to absolute path ────────
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=file:/home/bldcam/dev.db|" .env.production

# ── 3. Install all dependencies (Linux native) ──
#     node_modules from macOS rsync is excluded in deploy.sh,
#     so this installs clean Linux binaries.
rm -rf node_modules
npm install 2>&1 || {
  echo "WARNING: npm install failed — trying minimal sharp install"
  npm install --platform=linux --arch=x64 sharp@0.35.1 2>/dev/null || true
}

# ── 4. Update sharp cache in Next.js ────────────
SHARP_CACHE=$(ls -d .next/node_modules/sharp-* 2>/dev/null | head -1)
if [ -n "$SHARP_CACHE" ] && [ -d node_modules/sharp ]; then
  rm -rf "$SHARP_CACHE/build" "$SHARP_CACHE/vendor" "$SHARP_CACHE/install" 2>/dev/null
  for DIR in build vendor install; do
    [ -d "node_modules/sharp/$DIR" ] && cp -r "node_modules/sharp/$DIR" "$SHARP_CACHE/" 2>/dev/null || true
  done
fi

# ── 5. Start PM2 ────────────────────────────────
#     restart preserves uptime; start used on first run
pm2 restart bldcam 2>/dev/null || pm2 start server.js --name bldcam
pm2 save 2>/dev/null
