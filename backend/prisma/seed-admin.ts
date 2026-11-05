/**
 * تهيئة قاعدة جديدة بأقل ما يلزم للدخول: مدير عام + فئات الأصناف الأساسية (بلا بيانات تجريبية).
 * التشغيل: ADMIN_USERNAME=1 ADMIN_PASSWORD=... npm run seed:admin
 * كلمة المرور تُقرأ من المتغير ولا تُحفظ في أي ملف. آمن لإعادة التشغيل (لا يكرر ولا يمسح شيئاً).
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? '1';
  const password = process.env.ADMIN_PASSWORD;
  const email = (process.env.ADMIN_EMAIL ?? 'admin@company.sa').toLowerCase();
  if (!password || password.length < 6) throw new Error('حدّد ADMIN_PASSWORD (6 أحرف على الأقل)');

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, active: true, role: Role.ADMIN },
    create: { username, email, fullName: process.env.ADMIN_NAME ?? 'مدير النظام', role: Role.ADMIN, passwordHash },
  });

  for (const name of ['أجهزة إلكترونية', 'طابعات وأحبار', 'أدوات مكتبية', 'مطبوعات']) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`جاهز: المستخدم ${admin.username} (${admin.role}) + ${await prisma.category.count()} فئات`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
