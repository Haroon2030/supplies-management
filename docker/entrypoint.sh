#!/bin/bash
# تطبيق واحد في حاوية واحدة: الواجهة على $PORT (المنفذ الوحيد المكشوف) والـ API داخلياً على 4000.
# الواجهة تمرّر /api إلى الـ API (rewrite في next.config.ts)، فيراه المتصفح من العنوان نفسه.
set -euo pipefail

cd /app/backend
npx prisma migrate deploy

PORT=4000 node dist/main &
API_PID=$!

# المنفذ 4000 محجوز للـ API الداخلي؛ لو ضُبط PORT=4000 بالخطأ تتنافس الخدمتان عليه فيسقط الـ API (EADDRINUSE)
WEB_PORT="${PORT:-3000}"
if [ "$WEB_PORT" = "4000" ]; then
  echo "تنبيه: PORT=4000 محجوز للـ API الداخلي، سيعمل التطبيق على 3000. اضبط PORT=3000 في المتغيرات."
  WEB_PORT=3000
fi

cd /app/frontend
HOSTNAME=0.0.0.0 PORT="$WEB_PORT" node server.js &
WEB_PID=$!

trap 'kill "$API_PID" "$WEB_PID" 2>/dev/null || true' TERM INT

# إن توقف أيٌّ منهما تخرج الحاوية فيعيد Docker/Dokploy تشغيلها بدل بقاء نصف التطبيق ميتاً
wait -n
CODE=$?
echo "أحد الخدمتين توقفت (الرمز $CODE)، إيقاف الحاوية"
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit "$CODE"
