# المستودع المركزي — نظام الطلبات والمخزون والمشتريات

مجلدان مستقلان:

| المجلد | التقنية | المنفذ |
|---|---|---|
| `backend/` | NestJS 11 + Prisma 6 + SQLite (ملف محلي) + JWT + Swagger | 4000 (`/api`, الوثائق `/api/docs`) |
| `frontend/` | Next.js 15 (App Router) + Tailwind 4 + TanStack Query + Recharts | 3000 |

## التشغيل

لا حاجة لتثبيت قاعدة بيانات: التخزين في ملف SQLite محلي `backend/prisma/dev.db`.

```bash
cd backend && cp .env.example .env
npm install
npx prisma migrate deploy && npm run seed  # الهيكل + بيانات تجريبية
npm run start:dev

cd ../frontend && cp .env.example .env.local
npm install && npm run dev
```

حسابات تجريبية (كلمة المرور `Passw0rd!` — للتجربة فقط):
`sara@company.sa` موظف · `manager.it@company.sa` مدير إدارة · `keeper@company.sa` أمين المستودع · `admin@company.sa` مدير النظام.

## دورة الطلب

`موظف ← مدير الإدارة (اعتماد / تعديل الكمية / رفض / إعادة للتعديل) ← أمين المستودع (صرف FIFO) ← عجز؟ طلب شراء تلقائي ← فاتورة شراء ← إعادة الصرف`

- كل سطر فاتورة شراء يُنشئ **دفعة** في المخزون؛ الصرف يستهلك الأقدم أولاً (`backend/src/inventory/fifo.ts`، مع اختباراته).
- أرقام الطلبات وطلبات الشراء تُخصَّص في الخدمة (max+1 داخل المعاملة مع قيد unique) لأن SQLite لا يدعم autoincrement خارج المفتاح الأساسي، والتقارير مكتوبة بـ Prisma لتبقى مستقلة عن نوع القاعدة.
- الخصم من الدفعات مشروط (`qtyRemaining >= qty`) داخل معاملة واحدة لمنع الصرف المزدوج عند التزامن.
- مدير الإدارة إذا طلب بنفسه يُعتمد طلبه تلقائياً؛ ولا يعتمد أحد طلب نفسه.
- الصلاحيات تُفرض في الخادم (Guards + نطاق الرؤية حسب الدور) وليست في الواجهة فقط.

## الاختبارات
`cd backend && npm test` (خوارزمية FIFO). مسارات الصرف والعجز والفواتير والتقارير جُرّبت على SQLite فعلي عبر الـ API.
