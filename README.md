# المستودع المركزي — نظام الطلبات والمخزون والمشتريات

مجلدان مستقلان:

| المجلد | التقنية | المنفذ |
|---|---|---|
| `backend/` | NestJS 11 + Prisma 6 + MySQL/MariaDB + JWT + Swagger | 4000 (`/api`, الوثائق `/api/docs`) |
| `frontend/` | Next.js 15 (App Router) + Tailwind 4 + TanStack Query + Recharts | 3000 |

## التشغيل

الاتصال بقاعدة MySQL/MariaDB عبر `DATABASE_URL` في `backend/.env` (انسخه من `.env.example`، والملف الحقيقي غير مرفوع).

```bash
cd backend && cp .env.example .env   # عدّل DATABASE_URL
npm install
npx prisma migrate deploy            # إنشاء الجداول (لا يحتاج shadow database)
ADMIN_USERNAME=1 ADMIN_PASSWORD=<كلمة-سر> npm run seed:admin   # مدير + الفئات الأساسية فقط
# أو بيانات تجريبية كاملة (تمسح الجداول!): npm run seed
npm run start:dev

cd ../frontend && cp .env.example .env.local
npm install && npm run dev
```

على الاستضافة المشتركة: فعّل **Remote MySQL** وأضف عنوان IP جهازك، واترك `connection_limit` صغيراً.

حسابات تجريبية (كلمة المرور `Passw0rd!` — للتجربة فقط):
`sara@company.sa` موظف · `manager.it@company.sa` مدير إدارة · `keeper@company.sa` أمين المستودع · `admin@company.sa` مدير النظام.

## دورة الطلب

`موظف ← مدير الإدارة (اعتماد / تعديل الكمية / رفض / إعادة للتعديل) ← أمين المستودع (صرف FIFO) ← عجز؟ طلب شراء تلقائي ← فاتورة شراء ← إعادة الصرف`

- كل سطر فاتورة شراء يُنشئ **دفعة** في المخزون؛ الصرف يستهلك الأقدم أولاً (`backend/src/inventory/fifo.ts`، مع اختباراته).
- أرقام الطلبات وطلبات الشراء تُخصَّص في الخدمة (max+1 داخل المعاملة مع قيد unique) لأن Prisma مع MySQL لا يدعم autoincrement خارج المفتاح الأساسي، والتقارير مكتوبة بـ Prisma لتبقى مستقلة عن نوع القاعدة.
- الخصم من الدفعات مشروط (`qtyRemaining >= qty`) داخل معاملة واحدة لمنع الصرف المزدوج عند التزامن.
- مدير الإدارة إذا طلب بنفسه يُعتمد طلبه تلقائياً؛ ولا يعتمد أحد طلب نفسه.
- الصلاحيات تُفرض في الخادم (Guards + نطاق الرؤية حسب الدور) وليست في الواجهة فقط.

## الاختبارات
`cd backend && npm test` (خوارزمية FIFO). مسارات الصرف والعجز والفواتير والتقارير جُرّبت على قاعدة فعلية عبر الـ API.

## النشر على Dokploy: تطبيق واحد ومنفذ واحد

`Dockerfile` في **جذر المستودع** يبني الواجهة والـ API في صورة واحدة. الواجهة هي المنفذ الوحيد المكشوف وتمرّر `/api` للـ API داخل الحاوية، فلا حاجة لتطبيق ثانٍ ولا دومين ثانٍ ولا CORS.

- **Build Type:** Dockerfile · **Build Path:** `/` (الجذر) · **Dockerfile:** `Dockerfile`
- **المنفذ:** `3000` (أو أي قيمة في `PORT`، ويطابقه منفذ النطاق أو المنفذ المنشور)
- **المتغيرات:** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CORS_ORIGIN` (اختياري لأن العنوان واحد)
- ترحيلات القاعدة تُطبَّق تلقائياً عند كل إقلاع (`prisma migrate deploy`).
- **اتصالات القاعدة:** بعض الاستضافات (مثل Hostinger) تحدّ عدد الاتصالات الجديدة في الساعة (500 مثلاً). استخدم في `DATABASE_URL`:
  `?connection_limit=3&pool_timeout=20&connect_timeout=20&max_idle_connection_lifetime=3600`
  فتبقى الاتصالات مفتوحة ولا تتجدد باستمرار. ولا تشغّل نسخة محلية وأخرى حيّة على نفس القاعدة بكثرة؛ الأفضل قاعدة منفصلة للتطوير.
- إن بلغ الحد يردّ الخادم برسالة 503 مفهومة («الخدمة مشغولة مؤقتاً») ويتصفّر العدّاد مع بداية الساعة التالية.
- إن توقفت الواجهة أو الـ API تتوقف الحاوية كلها فيعيد Dokploy تشغيلها.
- للنشر على أن يكون كلٌّ منهما منفصلاً ما زال `backend/Dockerfile` و`frontend/Dockerfile` متاحين.
