#!/bin/bash
# deploy.sh — build locally and push to VPS
set -e

SSH_KEY="$HOME/.ssh/bldcam_vps"
VPS="ubuntu@43.131.13.220"
PORT="2222"
DIST="deploy-dist"

echo "🔨 Building..."
npm run build

echo "📦 Packaging standalone..."
rm -rf "$DIST"
mkdir -p "$DIST"
cp -r .next/standalone/* "$DIST/"
rsync -a --exclude='cache' --exclude='standalone/node_modules' .next/ "$DIST/.next/"
cp -r public "$DIST/" 2>/dev/null || true
mkdir -p "$DIST/prisma"
cp prisma/schema.prisma "$DIST/prisma/"
cp .env "$DIST/.env.production"

echo "🚀 Deploying to VPS..."
rsync -avz --delete \
  --exclude='dev.db' \
  --exclude='ecosystem.config.cjs' \
  --exclude='logs/' \
  --exclude='backups/' \
  -e "ssh -p $PORT -i $SSH_KEY" \
  "$DIST/" "$VPS:/home/bldcam/"

echo "🔧 Rebuilding native modules for Linux + replacing Next.js cache..."
ssh -p "$PORT" -i "$SSH_KEY" "$VPS" '
cd /home/bldcam

# 1) Install Linux sharp in node_modules
rm -rf node_modules/sharp
npm install --force --platform=linux --arch=x64 sharp@0.35.1

# 2) Replace macOS sharp in Next.js external cache with Linux binaries
SHARP_CACHE=$(ls -d .next/node_modules/sharp-* 2>/dev/null | head -1)
if [ -n "$SHARP_CACHE" ]; then
  rm -rf "$SHARP_CACHE/build" "$SHARP_CACHE/vendor" "$SHARP_CACHE/install" 2>/dev/null
  cp -r node_modules/sharp/build "$SHARP_CACHE/" 2>/dev/null || true
  cp -r node_modules/sharp/vendor "$SHARP_CACHE/" 2>/dev/null || true
  cp -r node_modules/sharp/install "$SHARP_CACHE/" 2>/dev/null || true
  echo "sharp cache replaced → $SHARP_CACHE"
fi

# 3) Delete + restart PM2 (forces fresh env reload, restart alone caches old env)
pm2 delete bldcam 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "  ✓ App restarted with fresh env"
'

echo ""
echo "✅ Deploy complete — https://bldcam.page"
