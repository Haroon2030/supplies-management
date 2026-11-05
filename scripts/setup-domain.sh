#!/usr/bin/env bash
# يُشغَّل على السيرفر (كـ root): يربط دومين بالتطبيقين عبر nginx الموجود ويفعّل HTTPS.
# الاستخدام:  bash setup-domain.sh supplies-mangmant.example.com [you@example.com]
# المتطلبات: سجل A للدومين يشير لهذا السيرفر، ومنفذ Dokploy المنشور 7095 (التطبيق الموحد: الواجهة + الـ API).
set -euo pipefail

HOST="${1:?الاستخدام: bash setup-domain.sh supplies-mangmant.example.com [email]}"
EMAIL="${2:-}"
WEB_PORT=7095   # التطبيق الموحد؛ الواجهة تمرّر /api للـ API داخلياً
CONF="/etc/nginx/sites-available/${HOST}"

# 1) تأكد أن الدومين يشير لهذا السيرفر قبل طلب الشهادة
RESOLVED="$(getent hosts "$HOST" | awk '{print $1}' | head -1 || true)"
echo "DNS: ${HOST} -> ${RESOLVED:-<لا يُحَل بعد>}"
[ -n "$RESOLVED" ] || { echo "السجل لم ينتشر بعد؛ انتظر قليلاً ثم أعد التشغيل"; exit 1; }

# 2) كتلة nginx: كل شيء إلى التطبيق الموحد (المسار /api تتولاه الواجهة داخلياً)
cat > "$CONF" <<NGINX
server {
    listen 80;
    server_name ${HOST};
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf "$CONF" "/etc/nginx/sites-enabled/${HOST}"
nginx -t
systemctl reload nginx

# 3) شهادة HTTPS مجانية (Let's Encrypt) مع تحويل HTTP→HTTPS
command -v certbot >/dev/null || { apt-get update -y && apt-get install -y certbot python3-certbot-nginx; }
if [ -n "$EMAIL" ]; then
  certbot --nginx -d "$HOST" --redirect --non-interactive --agree-tos -m "$EMAIL"
else
  certbot --nginx -d "$HOST" --redirect --non-interactive --agree-tos --register-unsafely-without-email
fi

echo "تم: https://${HOST}"
