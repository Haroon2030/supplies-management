/**
 * يضمن وجود المدير العام عند كل إقلاع/نشر (يُستدعى من docker/entrypoint.sh).
 * المتغيرات: ADMIN_USERNAME (افتراضي 1)، ADMIN_PASSWORD (إلزامي)، ADMIN_EMAIL، ADMIN_NAME.
 * يُنشئ المستخدم إن لم يوجد، وإن وُجد يضبط كلمة مروره على قيمة المتغير ويفعّله (المتغير هو المرجع).
 * JavaScript عادي (لا يحتاج ts-node) ويستخدم اعتماديات التشغيل فقط. لا يطبع كلمة المرور.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || '1';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 6) throw new Error('ADMIN_PASSWORD غير مضبوط أو أقصر من 6 أحرف');
  const email = (process.env.ADMIN_EMAIL || 'admin@company.sa').toLowerCase();

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, active: true, role: 'ADMIN' },
    create: { username, email, fullName: process.env.ADMIN_NAME || 'مدير النظام', role: 'ADMIN', passwordHash },
  });
  for (const name of ['أجهزة إلكترونية', 'طابعات وأحبار', 'أدوات مكتبية', 'مطبوعات']) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`المدير العام جاهز: المستخدم ${admin.username}`);
}

main()
  .catch((e) => { console.error('تعذر تجهيز المدير العام:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
