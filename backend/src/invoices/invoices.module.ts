import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, Param, Post, UseGuards, Delete, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { LONG_TX } from '../common/numbering';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';
import { ReplenishmentService } from '../purchase-requests/replenishment.service';

export class InvoiceLineDto {
  @IsString() itemId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999) unitCost!: number;
}
export class CreateInvoiceDto {
  @IsString() number!: string;
  @IsString() supplierId!: string;
  @IsOptional() @IsString() branchId?: string;
  @IsDateString() invoiceDate!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() purchaseRequestId?: string;
  /** نسبة الضريبة %، الافتراضي 15 (ضريبة القيمة المضافة). */
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatRate?: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService, private readonly replenishment: ReplenishmentService) {}

  list() {
    return this.prisma.purchaseInvoice.findMany({
      orderBy: { invoiceDate: 'desc' },
      take: 200,
      include: {
        supplier: { select: { name: true } },
        branch: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  get(id: string) {
    return this.prisma.purchaseInvoice.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: true, branch: true, createdBy: { select: { fullName: true } },
        purchaseRequest: { select: { number: true } },
        lines: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      },
    });
  }

  /**
   * إدخال فاتورة: كل سطر ينشئ دفعة مخزون جديدة (تغذي FIFO).
   * إن ربطت بطلب شراء يُعلَّم كمستلم.
   */
  /** حذف فاتورة (سوبر أدمن). يُرفض إن صُرف جزء من بضاعتها؛ احذف طلبات الصرف المرتبطة أولاً فتعود الكميات. */
  async remove(id: string) {
    const lines = await this.prisma.invoiceLine.findMany({ where: { invoiceId: id }, include: { batch: true } });
    if (!(await this.prisma.purchaseInvoice.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('الفاتورة غير موجودة');
    if (lines.some((l) => l.batch && l.batch.qtyRemaining < l.batch.qtyReceived)) {
      throw new ConflictException('صُرف جزء من بضاعة هذه الفاتورة. احذف طلبات الصرف المرتبطة بها أولاً ثم أعد المحاولة.');
    }
    const inv = await this.prisma.purchaseInvoice.findUniqueOrThrow({ where: { id }, select: { purchaseRequestId: true } });
    await this.prisma.purchaseInvoice.delete({ where: { id } }); // الأسطر والدفعات تُحذف تتابعياً
    await this.reopenPurchaseRequest(inv.purchaseRequestId);
    await this.replenishment.safeSync(); // نقص المخزون قد يولّد طلب شراء تلقائياً
    return { ok: true };
  }

  /** حذف المستند الذي أغلق طلب الشراء يُعيده مفتوحاً (ما لم يغطِّه مستند استلام آخر)، حتى لا يبقى «مستلماً» ولا بضاعة. */
  private async reopenPurchaseRequest(prId: string | null) {
    if (!prId) return;
    const [inv, sup] = await Promise.all([
      this.prisma.purchaseInvoice.count({ where: { purchaseRequestId: prId } }),
      this.prisma.supplyReceipt.count({ where: { purchaseRequestId: prId } }),
    ]);
    if (inv + sup === 0) await this.prisma.purchaseRequest.updateMany({ where: { id: prId, status: 'RECEIVED' }, data: { status: 'OPEN' } });
  }

  async create(user: AuthUser, dto: CreateInvoiceDto) {
    const branchId = dto.branchId ?? user.branchId;
    if (!branchId) throw new BadRequestException('حدد الفرع المستلِم للفاتورة');

    const dup = await this.prisma.purchaseInvoice.findUnique({
      where: { supplierId_number: { supplierId: dto.supplierId, number: dto.number } },
    });
    if (dup) throw new ConflictException('رقم الفاتورة مسجل لهذا المورد مسبقاً');

    if (dto.purchaseRequestId) {
      const pr = await this.prisma.purchaseRequest.findUnique({ where: { id: dto.purchaseRequestId } });
      if (!pr) throw new BadRequestException('طلب الشراء المرتبط غير موجود');
    }
    const itemCount = await this.prisma.item.count({ where: { id: { in: dto.lines.map((l) => l.itemId) } } });
    if (itemCount !== new Set(dto.lines.map((l) => l.itemId)).size) throw new BadRequestException('يوجد صنف غير موجود في الفاتورة');

    // التكلفة المدخلة قبل الضريبة؛ الإجمالي = المجموع + الضريبة (تقريب لأقرب هللة).
    const vatRate = dto.vatRate ?? 15;
    const subtotal = dto.lines.reduce((s, l) => s + Math.round(l.quantity * l.unitCost * 100), 0) / 100;
    const total = Math.round(subtotal * (1 + vatRate / 100) * 100) / 100;
    const date = new Date(dto.invoiceDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          number: dto.number, supplierId: dto.supplierId, branchId, invoiceDate: date,
          notes: dto.notes, createdById: user.id, purchaseRequestId: dto.purchaseRequestId,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)), vatRate, total: new Prisma.Decimal(total.toFixed(2)),
        },
      });
      for (const l of dto.lines) {
        const line = await tx.invoiceLine.create({
          data: { invoiceId: invoice.id, itemId: l.itemId, quantity: l.quantity, unitCost: l.unitCost },
        });
        await tx.stockBatch.create({
          data: {
            itemId: l.itemId, invoiceLineId: line.id, qtyReceived: l.quantity,
            qtyRemaining: l.quantity, unitCost: l.unitCost, receivedAt: date,
          },
        });
      }
      if (dto.purchaseRequestId) {
        await tx.purchaseRequest.update({ where: { id: dto.purchaseRequestId }, data: { status: 'RECEIVED' } });
      }
      return invoice;
    }, LONG_TX);
    // الاستلام رفع المخزون: تُغلق طلبات الحد الأدنى التي عولج نقصها
    await this.replenishment.safeSync();
    return created;
  }
}

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WAREHOUSE_KEEPER)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}
  @Get() list() { return this.svc.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateInvoiceDto) { return this.svc.create(u, dto); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ imports: [PurchaseRequestsModule], controllers: [InvoicesController], providers: [InvoicesService] })
export class InvoicesModule {}
