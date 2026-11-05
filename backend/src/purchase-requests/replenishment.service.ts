import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { nextNumber } from '../common/numbering';
import { PrismaService } from '../prisma/prisma.service';

/**
 * طلبات الشراء التلقائية عند بلوغ الحد الأدنى للصنف (نقطة إعادة الطلب).
 * تُستدعى بعد كل حركة تغيّر المخزون أو تعريف الأصناف، وعند فتح شاشة طلبات الشراء.
 * - لا يُنشأ طلب لصنف له طلب شراء مفتوح (من عجز أو من حد أدنى) حتى لا يتكرر.
 * - طلب الحد الأدنى المفتوح يُغلق تلقائياً (مستلم) متى عاد رصيد كل أصنافه فوق الحد.
 */
@Injectable()
export class ReplenishmentService implements OnModuleInit {
  private readonly log = new Logger(ReplenishmentService.name);
  private running: Promise<unknown> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() { void this.safeSync(); }

  /** لا يُفشل العملية الأصلية إن تعذّر الفحص؛ ويمنع تشغيلين متزامنين. */
  async safeSync() {
    if (this.running) return this.running;
    this.running = this.sync()
      .catch((e) => this.log.error(`replenishment sync failed: ${e}`))
      .finally(() => { this.running = null; });
    return this.running;
  }

  private async onHandByItem(): Promise<Map<string, number>> {
    const groups = await this.prisma.stockBatch.groupBy({ by: ['itemId'], where: { qtyRemaining: { gt: 0 } }, _sum: { qtyRemaining: true } });
    return new Map(groups.map((g) => [g.itemId, g._sum.qtyRemaining ?? 0]));
  }

  async sync(): Promise<{ created: number | null; closed: number }> {
    const items = await this.prisma.item.findMany({
      where: { active: true, minStock: { gt: 0 } },
      select: { id: true, minStock: true, reorderQty: true },
    });
    const onHand = await this.onHandByItem();
    const min = new Map(items.map((i) => [i.id, i.minStock]));

    // 1) إغلاق طلبات الحد الأدنى التي عولج نقصها
    const openReorder = await this.prisma.purchaseRequest.findMany({
      where: { kind: 'REORDER', status: { in: ['OPEN', 'ORDERED'] } }, include: { lines: true },
    });
    let closed = 0;
    for (const pr of openReorder) {
      const restocked = pr.lines.every((l) => (onHand.get(l.itemId) ?? 0) > (min.get(l.itemId) ?? 0));
      if (restocked) {
        await this.prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: 'RECEIVED' } });
        closed++;
      }
    }

    // 2) أصناف عند الحد الأدنى أو أقل ولا يغطيها طلب شراء مفتوح
    const covered = new Set(
      (await this.prisma.purchaseRequestLine.findMany({
        where: { purchaseRequest: { status: { in: ['OPEN', 'ORDERED'] } } }, select: { itemId: true },
      })).map((l) => l.itemId),
    );
    const lines = items
      .filter((i) => (onHand.get(i.id) ?? 0) <= i.minStock && !covered.has(i.id))
      .map((i) => {
        const have = onHand.get(i.id) ?? 0;
        return { itemId: i.id, quantity: i.reorderQty > 0 ? i.reorderQty : Math.max(i.minStock * 2 - have, 1) };
      });
    if (lines.length === 0) return { created: null, closed };

    const pr = await this.prisma.$transaction(async (tx) =>
      tx.purchaseRequest.create({ data: { number: await nextNumber(tx, 'purchase'), kind: 'REORDER', lines: { create: lines } } }),
    );
    return { created: pr.number, closed };
  }
}
