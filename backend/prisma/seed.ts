/**
 * بيانات تجريبية: فروع، إدارات، مستخدمون، أصناف، فواتير، وسجل طلبات
 * (الصرف التاريخي يمر عبر allocateFifo نفسها لتبقى الأرصدة متسقة).
 * كلمة مرور كل الحسابات التجريبية: Passw0rd!  — لا تستخدمها في الإنتاج.
 */
import { PrismaClient, RequestStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { allocateFifo } from '../src/inventory/fifo';

const prisma = new PrismaClient();

// مولد عشوائي ثابت لنتائج قابلة للتكرار
let s = 20260;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
let reqNo = 0; // أرقام الطلبات تُخصَّص يدوياً (SQLite)
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

async function main() {
  await prisma.$transaction([
    prisma.issueAllocation.deleteMany(), prisma.stockIssue.deleteMany(),
    prisma.purchaseRequestLine.deleteMany(), prisma.stockBatch.deleteMany(),
    prisma.invoiceLine.deleteMany(), prisma.purchaseInvoice.deleteMany(),
    prisma.purchaseRequest.deleteMany(), prisma.requestEvent.deleteMany(),
    prisma.requestLine.deleteMany(), prisma.request.deleteMany(),
    prisma.item.deleteMany(), prisma.category.deleteMany(), prisma.supplier.deleteMany(),
    prisma.user.deleteMany(), prisma.department.deleteMany(), prisma.branch.deleteMany(),
  ]);

  const hash = await bcrypt.hash('Passw0rd!', 10);

  /* الهيكل التنظيمي */
  const hq = await prisma.branch.create({ data: { name: 'المقر الرئيسي', city: 'الرياض' } });
  const jed = await prisma.branch.create({ data: { name: 'فرع جدة', city: 'جدة' } });
  const dmm = await prisma.branch.create({ data: { name: 'فرع الدمام', city: 'الدمام' } });
  const mk = (_b: string, name: string) => prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  const hqIT = await mk(hq.id, 'تقنية المعلومات');
  const hqHR = await mk(hq.id, 'الموارد البشرية');
  const hqFin = await mk(hq.id, 'المالية');
  const jedOps = await mk(jed.id, 'العمليات');
  const dmmOps = await mk(dmm.id, 'العمليات');
  const depts = [
    { d: hqIT, b: hq }, { d: hqHR, b: hq }, { d: hqFin, b: hq }, { d: jedOps, b: jed }, { d: dmmOps, b: dmm },
  ];

  /* المستخدمون */
  let userNo = 0; // رقم المستخدم للدخول: 1 للمدير العام ثم تسلسلي
  const mkUser = (email: string, fullName: string, role: Role, d?: { id: string }, b?: { id: string }) =>
    prisma.user.create({ data: { email, username: String(++userNo), fullName, role, passwordHash: hash, departmentId: d?.id, branchId: b?.id } });
  const admin = await mkUser('admin@company.sa', 'سلطان الدوسري', Role.ADMIN);
  const keeper = await mkUser('keeper@company.sa', 'ماجد العتيبي', Role.WAREHOUSE_KEEPER, undefined, hq);
  const managers = [
    await mkUser('manager.it@company.sa', 'خالد الشمري', Role.DEPT_MANAGER, hqIT, hq),
    await mkUser('manager.hr@company.sa', 'نورة القحطاني', Role.DEPT_MANAGER, hqHR, hq),
    await mkUser('manager.fin@company.sa', 'عبدالله الحربي', Role.DEPT_MANAGER, hqFin, hq),
    await mkUser('manager.jed@company.sa', 'فهد الغامدي', Role.DEPT_MANAGER, jedOps, jed),
    await mkUser('manager.dmm@company.sa', 'سعد المطيري', Role.DEPT_MANAGER, dmmOps, dmm),
  ];
  const emps = [
    await mkUser('sara@company.sa', 'سارة الزهراني', Role.EMPLOYEE, hqIT, hq),
    await mkUser('omar@company.sa', 'عمر السبيعي', Role.EMPLOYEE, hqIT, hq),
    await mkUser('reem@company.sa', 'ريم العنزي', Role.EMPLOYEE, hqHR, hq),
    await mkUser('yousef@company.sa', 'يوسف البلوي', Role.EMPLOYEE, hqFin, hq),
    await mkUser('lama@company.sa', 'لمى الشهري', Role.EMPLOYEE, jedOps, jed),
    await mkUser('nasser@company.sa', 'ناصر الدوسري', Role.EMPLOYEE, dmmOps, dmm),
  ];
  const deptIndex = new Map(depts.map((x, i) => [x.d.id, i]));

  /* الكتالوج */
  const cat = Object.fromEntries(
    await Promise.all(
      ['أجهزة إلكترونية', 'طابعات وأحبار', 'أدوات مكتبية', 'مطبوعات'].map(async (name) => [name, await prisma.category.create({ data: { name } })]),
    ),
  );
  const itemDefs: [string, string, string, string, number, number][] = [
    // sku, name, category, unit, minStock, baseCost
    ['ELC-001', 'حاسب محمول 15 بوصة', 'أجهزة إلكترونية', 'جهاز', 5, 3200],
    ['ELC-002', 'شاشة 24 بوصة', 'أجهزة إلكترونية', 'جهاز', 6, 640],
    ['ELC-003', 'لوحة مفاتيح ولاسلكي فأرة', 'أجهزة إلكترونية', 'طقم', 10, 95],
    ['ELC-004', 'سماعة رأس للاجتماعات', 'أجهزة إلكترونية', 'قطعة', 8, 180],
    ['PRN-001', 'طابعة ليزر أحادية', 'طابعات وأحبار', 'جهاز', 3, 1100],
    ['PRN-002', 'حبر ليزر أسود', 'طابعات وأحبار', 'علبة', 12, 210],
    ['PRN-003', 'حبر ملون (طقم)', 'طابعات وأحبار', 'طقم', 6, 540],
    ['OFF-001', 'ورق A4 (رزمة 500)', 'أدوات مكتبية', 'رزمة', 60, 14],
    ['OFF-002', 'أقلام حبر جاف (علبة 50)', 'أدوات مكتبية', 'علبة', 20, 32],
    ['OFF-003', 'دباسة مكتبية', 'أدوات مكتبية', 'قطعة', 15, 18],
    ['OFF-004', 'ملفات حافظة (50)', 'أدوات مكتبية', 'علبة', 15, 45],
    ['OFF-005', 'مفكرات سنوية', 'أدوات مكتبية', 'قطعة', 20, 25],
    ['PUB-001', 'بطاقات أعمال مطبوعة', 'مطبوعات', 'علبة', 10, 85],
    ['PUB-002', 'أظرف رسمية بشعار الشركة', 'مطبوعات', 'علبة', 10, 60],
    ['PUB-003', 'نماذج مطبوعة متعددة النسخ', 'مطبوعات', 'دفتر', 25, 22],
    ['PUB-004', 'كتيبات تعريفية', 'مطبوعات', 'حزمة', 8, 150],
  ];
  const items = await Promise.all(
    itemDefs.map(([sku, name, c, unit, minStock]) =>
      prisma.item.create({ data: { sku, name, unit, minStock, categoryId: cat[c].id } }),
    ),
  );
  const baseCost = new Map(items.map((it, i) => [it.id, itemDefs[i][5]]));

  const suppliers = await Promise.all(
    ['شركة الحلول التقنية', 'مكتبة جرير للجملة', 'مطابع الخليج', 'مؤسسة الأفق للتوريدات'].map((name, i) =>
      // أرقام ضريبية تجريبية فقط (15 رقماً تبدأ وتنتهي بـ 3 كالنمط السعودي)
      prisma.supplier.create({ data: { name, vatNumber: `3${String(1000000000 + i * 111111111).padStart(13, '0')}3` } }),
    ),
  );

  /* فواتير شراء على 5 أشهر: كل سطر دفعة FIFO بسعر مختلف قليلاً */
  const branchesArr = [hq, jed, dmm];
  let invNo = 1000;
  for (let m = 5; m >= 0; m--) {
    for (let k = 0; k < 3; k++) {
      const date = daysAgo(m * 30 + k * 7 + 3);
      const chosen = [...items].sort(() => rnd() - 0.5).slice(0, 6);
      const lines = chosen.map((it) => {
        const q = Math.round((it.minStock || 5) * (1.5 + rnd() * 2));
        const cost = Math.round(baseCost.get(it.id)! * (0.92 + rnd() * 0.2) * 100) / 100;
        return { itemId: it.id, quantity: q, unitCost: cost };
      });
      const total = lines.reduce((t, l) => t + l.quantity * l.unitCost, 0);
      const inv = await prisma.purchaseInvoice.create({
        data: {
          number: `INV-${++invNo}`, supplierId: pick(suppliers).id, branchId: branchesArr[(m + k) % 3].id,
          invoiceDate: date, subtotal: total.toFixed(2), vatRate: 15, total: (total * 1.15).toFixed(2), createdById: keeper.id,
        },
      });
      for (const l of lines) {
        const line = await prisma.invoiceLine.create({ data: { invoiceId: inv.id, ...l } });
        await prisma.stockBatch.create({
          data: { itemId: l.itemId, invoiceLineId: line.id, qtyReceived: l.quantity, qtyRemaining: l.quantity, unitCost: l.unitCost, receivedAt: date },
        });
      }
    }
  }

  /* سجل الطلبات */
  const statuses: RequestStatus[] = [
    'ISSUED', 'ISSUED', 'ISSUED', 'ISSUED', 'ISSUED', 'REJECTED', 'NEEDS_EDIT', 'PENDING_MANAGER', 'PENDING_WAREHOUSE', 'PARTIALLY_ISSUED',
  ];
  for (let n = 0; n < 60; n++) {
    const emp = pick(emps);
    const di = deptIndex.get(emp.departmentId!)!;
    const mgr = managers[di];
    const age = Math.floor(rnd() * 150);
    // الطلبات الحديثة جداً تبقى معلّقة لتظهر في الطوابير
    const status: RequestStatus = age < 6 ? pick(['PENDING_MANAGER', 'PENDING_WAREHOUSE'] as RequestStatus[]) : pick(statuses);
    const chosen = [...items].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 3));
    const created = daysAgo(age);

    const req = await prisma.request.create({
      data: {
        number: ++reqNo, requesterId: emp.id, departmentId: emp.departmentId!, branchId: emp.branchId!, status: 'PENDING_MANAGER',
        justification: pick(['احتياج تشغيلي', 'استبدال تالف', 'موظف جديد', 'مشروع جديد']), createdAt: created,
        lines: { create: chosen.map((it) => ({ itemId: it.id, quantity: 1 + Math.floor(rnd() * 5) })) },
        events: { create: { actorId: emp.id, action: 'SUBMITTED', createdAt: created } },
      },
      include: { lines: true },
    });
    if (status === 'PENDING_MANAGER') continue;

    const evt = (actorId: string, action: string, note?: string) =>
      prisma.requestEvent.create({ data: { requestId: req.id, actorId, action, note, createdAt: new Date(created.getTime() + 36e5 * 5) } });

    if (status === 'REJECTED' || status === 'NEEDS_EDIT') {
      await evt(mgr.id, status === 'REJECTED' ? 'REJECTED' : 'RETURNED', status === 'REJECTED' ? 'خارج الميزانية' : 'حدد الكمية بدقة');
      await prisma.request.update({ where: { id: req.id }, data: { status } });
      continue;
    }

    // معتمد: ننسخ الكمية المعتمدة
    await evt(mgr.id, 'APPROVED');
    for (const l of req.lines) await prisma.requestLine.update({ where: { id: l.id }, data: { approvedQty: l.quantity } });
    if (status === 'PENDING_WAREHOUSE') {
      await prisma.request.update({ where: { id: req.id }, data: { status } });
      continue;
    }

    // صرف تاريخي فعلي عبر FIFO (يتوقف عند نفاد المخزون)
    const issue = await prisma.stockIssue.create({ data: { requestId: req.id, issuedById: keeper.id, issuedAt: new Date(created.getTime() + 36e5 * 20) } });
    let short = false;
    for (const l of req.lines) {
      const batches = await prisma.stockBatch.findMany({ where: { itemId: l.itemId, qtyRemaining: { gt: 0 } } });
      const { allocations, shortage } = allocateFifo(batches, l.quantity);
      for (const a of allocations) {
        await prisma.stockBatch.update({ where: { id: a.batchId }, data: { qtyRemaining: { decrement: a.quantity } } });
        await prisma.issueAllocation.create({ data: { issueId: issue.id, batchId: a.batchId, itemId: l.itemId, quantity: a.quantity, unitCost: a.unitCost } });
      }
      await prisma.requestLine.update({ where: { id: l.id }, data: { issuedQty: l.quantity - shortage } });
      if (shortage > 0) short = true;
    }
    await evt(keeper.id, 'ISSUED');
    await prisma.request.update({ where: { id: req.id }, data: { status: short ? 'PARTIALLY_ISSUED' : 'ISSUED' } });
  }

  /* حالة عرض واضحة: طلب مدير بعجز → طلب شراء مفتوح */
  const laptop = items[0];
  const demo = await prisma.request.create({
    data: {
      number: ++reqNo, requesterId: emps[0].id, departmentId: hqIT.id, branchId: hq.id, status: 'PENDING_WAREHOUSE',
      justification: 'تجهيز فريق التطوير الجديد',
      lines: { create: [{ itemId: laptop.id, quantity: 40, approvedQty: 40 }] },
      events: { create: [{ actorId: emps[0].id, action: 'SUBMITTED' }, { actorId: managers[0].id, action: 'APPROVED' }] },
    },
  });
  void demo; void admin;
  console.log('Seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
