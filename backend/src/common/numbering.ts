import { Prisma } from '@prisma/client';

/**
 * رقم تسلسلي للطلبات/طلبات الشراء. SQLite لا يدعم autoincrement خارج المفتاح الأساسي،
 * فنأخذ max+1 داخل المعاملة؛ والقيد unique يحمي من التكرار عند التزامن النادر.
 */
export async function nextNumber(tx: Prisma.TransactionClient, kind: 'request' | 'purchase'): Promise<number> {
  const agg = kind === 'request'
    ? await tx.request.aggregate({ _max: { number: true } })
    : await tx.purchaseRequest.aggregate({ _max: { number: true } });
  return (agg._max.number ?? 0) + 1;
}
