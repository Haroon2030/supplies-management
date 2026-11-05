/**
 * خوارزمية FIFO لتوزيع كمية مطلوبة على دفعات المخزون.
 * دالة نقية (بدون قاعدة بيانات) لتسهل اختبارها: الدفعات الأقدم استلاماً تُستهلك أولاً.
 */
export interface BatchLike<C = unknown> {
  id: string;
  qtyRemaining: number;
  unitCost: C;
  receivedAt: Date;
}

export interface Allocation<C = unknown> {
  batchId: string;
  quantity: number;
  unitCost: C;
}

export interface FifoResult<C = unknown> {
  allocations: Allocation<C>[];
  /** الكمية التي لم تتوفر في المخزون. */
  shortage: number;
}

export function allocateFifo<C>(batches: BatchLike<C>[], quantity: number): FifoResult<C> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError('الكمية يجب أن تكون عدداً صحيحاً غير سالب');
  }
  const ordered = [...batches]
    .filter((b) => b.qtyRemaining > 0)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id));

  const allocations: Allocation<C>[] = [];
  let left = quantity;
  for (const batch of ordered) {
    if (left === 0) break;
    const take = Math.min(batch.qtyRemaining, left);
    allocations.push({ batchId: batch.id, quantity: take, unitCost: batch.unitCost });
    left -= take;
  }
  return { allocations, shortage: left };
}
