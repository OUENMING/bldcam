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

echo "🔧 Uploading setup script + triggering remote install..."
scp -P "$PORT" -i "$SSH_KEY" vps-setup.sh "$VPS:/home/bldcam/"

# Fire-and-forget: nohup survives SSH disconnect
ssh -p "$PORT" -i "$SSH_KEY" "$VPS" \
  "nohup bash /home/bldcam/vps-setup.sh > /tmp/bldcam-deploy.log 2>&1 &"

# Poll until PM2 shows the new process online (max 120s)
echo "⏳ Waiting for PM2 restart..."
for i in $(seq 1 24); do
  sleep 5
  STATUS=$(ssh -p "$PORT" -i "$SSH_KEY" "$VPS" \
    "pm2 jlist 2>/dev/null" 2>/dev/null | \
    python3 -c "
import json,sys
apps=json.load(sys.stdin)
bldcam=[a for a in apps if a.get('name')=='bldcam']
if bldcam: print(bldcam[0].get('pm2_env',{}).get('status','unknown'))
else: print('missing')
" 2>/dev/null)
  if [ "$STATUS" = "online" ]; then
    echo "  ✓ PM2 online after $((i*5))s"
    break
  fi
  echo "  ...${STATUS:-checking} ($((i*5))s)"
done

echo ""
echo "✅ Deploy complete — https://bldcam.page"
