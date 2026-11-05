import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, Module, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { LONG_TX, nextNumber, retryOnUnique } from '../common/numbering';
import { PrismaService } from '../prisma/prisma.service';
import { ReplenishmentService } from './replenishment.service';

export class MergeDto {
  /** بلا قيمة = كل الطلبات النشطة (المفتوحة والمطلوبة من المورد). */
  @IsOptional() @IsArray() @ArrayMinSize(2) @IsString({ each: true }) ids?: string[];
}

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly replenishment: ReplenishmentService) {}

  async list() {
    await this.replenishment.safeSync(); // يضمن ظهور طلبات الحد الأدنى فور فتح الشاشة
    return this.prisma.purchaseRequest.findMany({
      where: { mergedIntoId: null }, // الطلبات المصدر بعد التجميع تُخفى (تظهر داخل الطلب المجمّع)
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        mergedFrom: {
          orderBy: { number: 'asc' },
          select: {
            number: true,
            request: { select: { number: true, branch: { select: { name: true } }, department: { select: { name: true } }, section: { select: { name: true } } } },
            lines: { select: { quantity: true, item: { select: { name: true } } } },
          },
        },
        request: { select: { id: true, number: true, department: { select: { name: true } }, branch: { select: { name: true } } } },
        lines: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      },
    });
  }

  /** حذف طلب شراء (سوبر أدمن). الفواتير المرتبطة تبقى ويُفك ارتباطها فقط. */
  async remove(id: string) {
    await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      // حذف طلب مجمّع يُعيد الطلبات المصدر إلى حالتها المفتوحة (فك التجميع)
      this.prisma.purchaseRequest.updateMany({ where: { mergedIntoId: id }, data: { mergedIntoId: null, status: 'OPEN' } }),
      this.prisma.purchaseInvoice.updateMany({ where: { purchaseRequestId: id }, data: { purchaseRequestId: null } }),
      this.prisma.purchaseRequest.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /** يجمع طلبات الشراء النشطة في طلب واحد بمجموع كميات كل صنف، ويُلغي المصدر (يبقى مرتبطاً به). */
  async merge(dto: MergeDto) {
    const prs = await this.prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['OPEN', 'ORDERED'] }, mergedIntoId: null, kind: { not: 'CONSOLIDATED' },
        ...(dto.ids?.length ? { id: { in: dto.ids } } : {}),
      },
      include: { lines: true },
    });
    if (dto.ids?.length && prs.length !== new Set(dto.ids).size) throw new ConflictException('بعض الطلبات المختارة لم تعد نشطة');
    if (prs.length < 2) throw new BadRequestException('يلزم طلبا شراء نشطان على الأقل للتجميع');

    const totals = new Map<string, number>();
    for (const pr of prs) for (const l of pr.lines) totals.set(l.itemId, (totals.get(l.itemId) ?? 0) + l.quantity);
    const allOrdered = prs.every((p) => p.status === 'ORDERED');

    return retryOnUnique(() => this.prisma.$transaction(async (tx) => {
      const merged = await tx.purchaseRequest.create({
        data: {
          number: await nextNumber(tx, 'purchase'), kind: 'CONSOLIDATED', status: allOrdered ? 'ORDERED' : 'OPEN',
          lines: { create: [...totals].map(([itemId, quantity]) => ({ itemId, quantity })) },
        },
      });
      await tx.purchaseRequest.updateMany({ where: { id: { in: prs.map((p) => p.id) } }, data: { status: 'CANCELLED', mergedIntoId: merged.id } });
      return merged;
    }, LONG_TX));
  }

  async markOrdered(id: string) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
    if (pr.status !== 'OPEN') throw new ConflictException('طلب الشراء ليس مفتوحاً');
    return this.prisma.purchaseRequest.update({ where: { id }, data: { status: 'ORDERED' } });
  }
}

@ApiTags('purchase-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WAREHOUSE_KEEPER)
@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly svc: PurchaseRequestsService) {}
  @Get() list() { return this.svc.list(); }
  @Post('merge') merge(@Body() dto: MergeDto) { return this.svc.merge(dto); }
  @Post(':id/ordered') ordered(@Param('id') id: string) { return this.svc.markOrdered(id); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService, ReplenishmentService],
  exports: [ReplenishmentService],
})
export class PurchaseRequestsModule {}
