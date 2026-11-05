/**
 * ينسخ كل البيانات من قاعدة قديمة (LEGACY_DATABASE_URL) إلى القاعدة الحالية (DATABASE_URL).
 * يُستدعى من docker/entrypoint.sh عند ضبط LEGACY_DATABASE_URL، وبعد `prisma migrate deploy` وقبل إنشاء المدير.
 *
 * - آمن للتكرار: السجلات الموجودة (بنفس المفتاح) تُتجاوز ولا تُكرَّر.
 * - الترتيب يُشتق من علاقات النموذج تلقائياً (الجداول الأب أولاً)، فلا يلزم تعديله عند إضافة جداول.
 * - لا يعدّل القاعدة القديمة (قراءة فقط) ولا يطبع كلمات المرور أو روابط الاتصال.
 * - `node scripts/import-legacy.js --plan` يطبع ترتيب النسخ فقط دون أي اتصال.
 */
const { Prisma, PrismaClient } = require('@prisma/client');

const CHUNK = 500;

/** ترتيب طوبولوجي للنماذج حسب مفاتيحها الأجنبية الإلزامية ثم الاختيارية. */
function copyOrder() {
  const models = Prisma.dmmf.datamodel.models;
  const names = models.map((m) => m.name);
  const edges = new Map(names.map((n) => [n, { required: new Set(), optional: new Set() }]));
  for (const m of models) {
    for (const f of m.fields) {
      if (f.kind !== 'object' || !f.relationFromFields || f.relationFromFields.length === 0) continue;
      if (f.type === m.name) continue; // علاقة ذاتية
      const optional = m.fields.filter((x) => f.relationFromFields.includes(x.name)).every((x) => !x.isRequired);
      edges.get(m.name)[optional ? 'optional' : 'required'].add(f.type);
    }
  }
  const order = [];
  const done = new Set();
  const visit = (n, stack) => {
    if (done.has(n)) return;
    if (stack.includes(n)) return; // دورة عبر علاقات اختيارية: نكسرها (FK checks معطّلة أثناء النسخ)
    for (const d of [...edges.get(n).required, ...edges.get(n).optional]) visit(d, [...stack, n]);
    if (!done.has(n)) { done.add(n); order.push(n); }
  };
  names.forEach((n) => visit(n, []));
  return order;
}

const delegate = (client, model) => client[model.charAt(0).toLowerCase() + model.slice(1)];

function withOneConnection(url) {
  const u = new URL(url);
  u.searchParams.set('connection_limit', '1'); // اتصال واحد حتى يبقى SET FOREIGN_KEY_CHECKS ساري المفعول
  return u.toString();
}

async function main() {
  const order = copyOrder();
  if (process.argv.includes('--plan')) {
    console.log(order.join(' -> '));
    return;
  }
  const from = process.env.LEGACY_DATABASE_URL;
  const to = process.env.DATABASE_URL;
  if (!from) throw new Error('LEGACY_DATABASE_URL غير مضبوط');
  if (!to) throw new Error('DATABASE_URL غير مضبوط');
  if (from === to) throw new Error('القاعدة القديمة والجديدة متطابقتان');

  const src = new PrismaClient({ datasources: { db: { url: withOneConnection(from) } } });
  const dst = new PrismaClient({ datasources: { db: { url: withOneConnection(to) } } });
  try {
    await src.$connect();
    await dst.$connect();
    await dst.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');

    // مدير أُنشئ تلقائياً في القاعدة الجديدة قبل الاستيراد بمعرّف مختلف: يُستبدل بنسخة المصدر (نفس رقم المستخدم)
    const srcUsers = await src.user.findMany({ select: { id: true, username: true, email: true } });
    for (const u of srcUsers) {
      await dst.user.deleteMany({
        where: { id: { not: u.id }, OR: [{ email: u.email }, ...(u.username ? [{ username: u.username }] : [])] },
      });
    }

    let total = 0;
    for (const model of order) {
      const rows = await delegate(src, model).findMany();
      let copied = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await delegate(dst, model).createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
        copied += res.count;
      }
      total += copied;
      console.log(`${model}: ${rows.length} في المصدر، ${copied} نُسخ`);
    }
    await dst.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
    console.log(`تم الاستيراد: ${total} سجلاً`);
  } finally {
    await src.$disconnect().catch(() => {});
    await dst.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error('فشل الاستيراد:', String(e.message || e).split('\n').filter(Boolean).slice(-2).join(' | '));
  process.exit(1);
});
