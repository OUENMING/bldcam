#!/bin/bash
# Baidu URL push — submits all photo detail page URLs from sitemap
# Usage: bash scripts/baidu-push.sh

SITEMAP="https://bldcam.page/sitemap.xml"
BAIDU_API="http://data.zz.baidu.com/urls?site=https://www.bldcam.page&token=fvolPegSQLTHY2u9"

echo "📤 Fetching sitemap..."
URLS=$(curl -s "$SITEMAP" | python3 -c "
import sys, re
xml = sys.stdin.read()
urls = re.findall(r'<loc>(https://bldcam\.page/[^<]+)</loc>', xml)
# Convert to www for Baidu push
urls = [u.replace('https://bldcam.page', 'https://www.bldcam.page') for u in urls]
print('\n'.join(urls))
")
COUNT=$(echo "$URLS" | wc -l | tr -d ' ')

echo "📋 $COUNT URLs found"

# Baidu free tier: 10 URLs/day. Push photos first, then homepage.
HEAD=$(echo "$URLS" | grep '/photo/' | head -9)
TAIL=$(echo "$URLS" | grep -v '/photo/' | head -1)
PUSH=$(printf "%s\n%s" "$HEAD" "$TAIL" | grep -v '^$')
PUSH_COUNT=$(echo "$PUSH" | wc -l | tr -d ' ')
echo "🎯 Pushing $PUSH_COUNT URLs (daily quota)"
echo "$PUSH" > /tmp/baidu-urls.txt

echo "🚀 Pushing to Baidu..."
RESPONSE=$(curl -s -H 'Content-Type:text/plain' --data-binary @/tmp/baidu-urls.txt "$BAIDU_API")

echo "✅ Response: $RESPONSE"

# Parse response
SUCCESS=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('success',0))" 2>/dev/null || echo "?")
REMAIN=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('remain',0))" 2>/dev/null || echo "?")

echo ""
echo "📊 成功: $SUCCESS | 剩余配额: $REMAIN"

rm -f /tmp/baidu-urls.txt
