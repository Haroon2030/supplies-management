import { allocateFifo } from './fifo';

const d = (s: string) => new Date(s);
const batches = [
  { id: 'b2', qtyRemaining: 5, unitCost: 12, receivedAt: d('2026-02-01') },
  { id: 'b1', qtyRemaining: 3, unitCost: 10, receivedAt: d('2026-01-01') },
  { id: 'b3', qtyRemaining: 0, unitCost: 9, receivedAt: d('2025-12-01') },
];

describe('allocateFifo', () => {
  it('يستهلك الدفعة الأقدم أولاً ثم ينتقل للتالية', () => {
    const r = allocateFifo(batches, 6);
    expect(r.allocations).toEqual([
      { batchId: 'b1', quantity: 3, unitCost: 10 },
      { batchId: 'b2', quantity: 3, unitCost: 12 },
    ]);
    expect(r.shortage).toBe(0);
  });

  it('يتجاهل الدفعات الفارغة ويُرجع العجز عند نقص المخزون', () => {
    const r = allocateFifo(batches, 10);
    expect(r.allocations.map((a) => a.quantity)).toEqual([3, 5]);
    expect(r.shortage).toBe(2);
  });

  it('كمية صفر لا تُنشئ توزيعات', () => {
    expect(allocateFifo(batches, 0)).toEqual({ allocations: [], shortage: 0 });
  });

  it('لا يعدّل مصفوفة الدخل', () => {
    const copy = JSON.stringify(batches);
    allocateFifo(batches, 4);
    expect(JSON.stringify(batches)).toBe(copy);
  });

  it('يرفض كميات غير صحيحة', () => {
    expect(() => allocateFifo(batches, -1)).toThrow(RangeError);
    expect(() => allocateFifo(batches, 1.5)).toThrow(RangeError);
  });
});
