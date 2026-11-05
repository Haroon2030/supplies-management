#!/bin/bash
# تطبيق واحد في حاوية واحدة: الواجهة على $PORT (المنفذ الوحيد المكشوف) والـ API داخلياً على 4000.
# الواجهة تمرّر /api إلى الـ API (rewrite في next.config.ts)، فيراه المتصفح من العنوان نفسه.
set -euo pipefail

cd /app/backend
npx prisma migrate deploy

PORT=4000 node dist/main &
API_PID=$!

cd /app/frontend
HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" node server.js &
WEB_PID=$!

trap 'kill "$API_PID" "$WEB_PID" 2>/dev/null || true' TERM INT

# إن توقف أيٌّ منهما تخرج الحاوية فيعيد Docker/Dokploy تشغيلها بدل بقاء نصف التطبيق ميتاً
wait -n
CODE=$?
echo "أحد الخدمتين توقفت (الرمز $CODE)، إيقاف الحاوية"
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit "$CODE"
