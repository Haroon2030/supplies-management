import { Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** رصيد كل صنف مع قيمته الدفترية ودفعاته الفعّالة بترتيب FIFO. */
  async stock() {
    const items = await this.prisma.item.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        category: true,
        batches: {
          where: { qtyRemaining: { gt: 0 } },
          orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
          include: { invoiceLine: { include: { invoice: { select: { number: true } } } } },
        },
      },
    });
    return items.map((i) => {
      const onHand = i.batches.reduce((s, b) => s + b.qtyRemaining, 0);
      const value = i.batches.reduce((s, b) => s + b.qtyRemaining * Number(b.unitCost), 0);
      return {
        id: i.id, sku: i.sku, name: i.name, unit: i.unit, category: i.category.name,
        categoryId: i.categoryId, minStock: i.minStock, reorderQty: i.reorderQty, onHand, value, low: onHand <= i.minStock,
        batches: i.batches.map((b) => ({
          id: b.id, invoiceNumber: b.invoiceLine.invoice.number, receivedAt: b.receivedAt,
          qtyReceived: b.qtyReceived, qtyRemaining: b.qtyRemaining, unitCost: Number(b.unitCost),
        })),
      };
    });
  }

  /** سجل حركة الصرف (تفصيل الدفعات المستهلكة). */
  movements(limit = 50) {
    return this.prisma.stockIssue.findMany({
      orderBy: { issuedAt: 'desc' },
      take: limit,
      include: {
        issuedBy: { select: { fullName: true } },
        request: { select: { number: true, department: { select: { name: true } } } },
        allocations: { include: { batch: { select: { item: { select: { name: true } } } } } },
      },
    });
  }
}

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WAREHOUSE_KEEPER)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}
  @Get() stock() { return this.svc.stock(); }
  @Get('movements') movements(@Query('limit') limit?: string) {
    return this.svc.movements(Math.min(Number(limit) || 50, 200));
  }
}

@Module({ controllers: [InventoryController], providers: [InventoryService], exports: [InventoryService] })
export class InventoryModule {}
