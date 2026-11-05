import { Prisma } from '@prisma/client';

/**
 * رقم تسلسلي للطلبات/طلبات الشراء. SQLite لا يدعم autoincrement خارج المفتاح الأساسي،
 * فنأخذ max+1 داخل المعاملة؛ والقيد unique يحمي من التكرار عند التزامن النادر.
 */
export async function nextNumber(tx: Prisma.TransactionClient, kind: 'request' | 'purchase' | 'supply'): Promise<number> {
  const agg = kind === 'request'
    ? await tx.request.aggregate({ _max: { number: true } })
    : kind === 'supply'
      ? await tx.supplyReceipt.aggregate({ _max: { number: true } })
      : await tx.purchaseRequest.aggregate({ _max: { number: true } });
  return (agg._max.number ?? 0) + 1;
}

/**
 * الرقم التالي = max+1 داخل المعاملة؛ عند تزامن طلبين قد يحصلان على الرقم نفسه فيفشل أحدهما بقيد unique (P2002).
 * نعيد المحاولة (برقم جديد) بدل إظهار خطأ 500 للمستخدم.
 */
export async function retryOnUnique<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i < tries && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
      throw e;
    }
  }
}

/** مهلة معاملات الصرف والتجميع والحذف: الافتراضية 5 ثوانٍ لا تكفي مع قاعدة بعيدة وعدة أسطر. */
export const LONG_TX = { timeout: 30_000, maxWait: 10_000 } as const;
