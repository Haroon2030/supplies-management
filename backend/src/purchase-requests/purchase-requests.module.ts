import { ConflictException, Controller, Delete, Get, Injectable, Module, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { ReplenishmentService } from './replenishment.service';

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly replenishment: ReplenishmentService) {}

  async list() {
    await this.replenishment.safeSync(); // يضمن ظهور طلبات الحد الأدنى فور فتح الشاشة
    return this.prisma.purchaseRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        request: { select: { id: true, number: true, department: { select: { name: true } }, branch: { select: { name: true } } } },
        lines: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      },
    });
  }

  /** حذف طلب شراء (سوبر أدمن). الفواتير المرتبطة تبقى ويُفك ارتباطها فقط. */
  async remove(id: string) {
    await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.purchaseInvoice.updateMany({ where: { purchaseRequestId: id }, data: { purchaseRequestId: null } }),
      this.prisma.purchaseRequest.delete({ where: { id } }),
    ]);
    return { ok: true };
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
  @Post(':id/ordered') ordered(@Param('id') id: string) { return this.svc.markOrdered(id); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService, ReplenishmentService],
  exports: [ReplenishmentService],
})
export class PurchaseRequestsModule {}
