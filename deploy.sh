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

echo "🔧 Rebuilding native modules for Linux..."
ssh -p "$PORT" -i "$SSH_KEY" "$VPS" \
  'cd /home/bldcam && npm install --os=linux --cpu=x64 --libc=glibc sharp && pm2 restart bldcam --update-env'

echo ""
echo "✅ Deploy complete — https://bldcam.page"
