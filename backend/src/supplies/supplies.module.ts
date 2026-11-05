import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { nextNumber } from '../common/numbering';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';
import { ReplenishmentService } from '../purchase-requests/replenishment.service';

export class SupplyLineDto {
  @IsString() itemId!: string;
  @IsInt() @Min(1) quantity!: number;
  /** التكلفة اختيارية (صفر إن لم تُعرف، مثل التبرعات) وتدخل في تقييم المخزون FIFO. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost?: number;
}
export class CreateSupplyDto {
  @IsOptional() @IsString() branchId?: string;
  @IsDateString() receivedAt!: string;
  /** مصدر التوريد: تبرع، رصيد افتتاحي، تحويل من فرع، عهدة... */
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() notes?: string;
  /** يُعلَّم طلب الشراء المرتبط كمستلم. */
  @IsOptional() @IsString() purchaseRequestId?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SupplyLineDto)
  lines!: SupplyLineDto[];
}

@Injectable()
export class SuppliesService {
  constructor(private readonly prisma: PrismaService, private readonly replenishment: ReplenishmentService) {}

  list() {
    return this.prisma.supplyReceipt.findMany({
      orderBy: [{ receivedAt: 'desc' }, { number: 'desc' }],
      take: 200,
      include: {
        branch: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  get(id: string) {
    return this.prisma.supplyReceipt.findUniqueOrThrow({
      where: { id },
      include: {
        branch: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        purchaseRequest: { select: { number: true } },
        lines: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      },
    });
  }

  /** كل سطر ينشئ دفعة مخزون (تغذي FIFO) تماماً كسطر الفاتورة. */
  async create(user: AuthUser, dto: CreateSupplyDto) {
    const branchId = dto.branchId ?? user.branchId;
    if (!branchId) throw new BadRequestException('حدد الفرع المستلِم');
    if (!(await this.prisma.branch.count({ where: { id: branchId } }))) throw new BadRequestException('الفرع غير موجود');

    const ids = dto.lines.map((l) => l.itemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('الصنف مكرر في السند');
    if ((await this.prisma.item.count({ where: { id: { in: ids } } })) !== ids.length) throw new BadRequestException('يوجد صنف غير موجود في السند');
    if (dto.purchaseRequestId && !(await this.prisma.purchaseRequest.count({ where: { id: dto.purchaseRequestId } }))) {
      throw new BadRequestException('طلب الشراء المرتبط غير موجود');
    }
    const date = new Date(dto.receivedAt);

    const created = await this.prisma.$transaction(async (tx) => {
      const supply = await tx.supplyReceipt.create({
        data: {
          number: await nextNumber(tx, 'supply'), branchId, receivedAt: date,
          source: dto.source?.trim() || null, notes: dto.notes?.trim() || null,
          createdById: user.id, purchaseRequestId: dto.purchaseRequestId || null,
        },
      });
      for (const l of dto.lines) {
        const cost = new Prisma.Decimal((l.unitCost ?? 0).toFixed(2));
        const line = await tx.supplyLine.create({ data: { supplyId: supply.id, itemId: l.itemId, quantity: l.quantity, unitCost: cost } });
        await tx.stockBatch.create({
          data: { itemId: l.itemId, supplyLineId: line.id, qtyReceived: l.quantity, qtyRemaining: l.quantity, unitCost: cost, receivedAt: date },
        });
      }
      if (dto.purchaseRequestId) {
        await tx.purchaseRequest.update({ where: { id: dto.purchaseRequestId }, data: { status: 'RECEIVED' } });
      }
      return supply;
    });
    await this.replenishment.safeSync(); // التوريد رفع المخزون: تُغلق طلبات الحد الأدنى المعالَجة
    return created;
  }

  /** حذف سند (سوبر أدمن). يُرفض إن صُرف جزء من بضاعته؛ احذف طلبات الصرف المرتبطة أولاً فتعود الكميات. */
  async remove(id: string) {
    const lines = await this.prisma.supplyLine.findMany({ where: { supplyId: id }, include: { batch: true } });
    if (!(await this.prisma.supplyReceipt.count({ where: { id } }))) throw new NotFoundException('السند غير موجود');
    if (lines.some((l) => l.batch && l.batch.qtyRemaining < l.batch.qtyReceived)) {
      throw new ConflictException('صُرف جزء من بضاعة هذا السند. احذف طلبات الصرف المرتبطة به أولاً ثم أعد المحاولة.');
    }
    await this.prisma.supplyReceipt.delete({ where: { id } }); // الأسطر والدفعات تُحذف تتابعياً
    await this.replenishment.safeSync();
    return { ok: true };
  }
}

@ApiTags('supplies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WAREHOUSE_KEEPER)
@Controller('supplies')
export class SuppliesController {
  constructor(private readonly svc: SuppliesService) {}
  @Get() list() { return this.svc.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateSupplyDto) { return this.svc.create(u, dto); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ imports: [PurchaseRequestsModule], controllers: [SuppliesController], providers: [SuppliesService] })
export class SuppliesModule {}
