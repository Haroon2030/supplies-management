import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module,
  NotFoundException, Param, Patch, Post, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, RequestStatus, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { allocateFifo } from '../inventory/fifo';
import { LONG_TX, nextNumber, retryOnUnique } from '../common/numbering';
import { requesterScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';
import { ReplenishmentService } from '../purchase-requests/replenishment.service';

/* ----------------------------- DTOs ----------------------------- */
export class RequestLineDto {
  @IsString() itemId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}
export class SaveRequestDto {
  @IsOptional() @IsString() @MaxLength(500) justification?: string;
  /** للمدير العام وأمين المستودع فقط (حسابهما بلا إدارة/فرع)؛ غيرهما يُستخدم مكانهما المسجّل. */
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() branchId?: string;
  /** القسم اختياري ومستقل عن الفرع والإدارة. */
  @IsOptional() @IsString() sectionId?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RequestLineDto)
  lines!: RequestLineDto[];
}
export class ApprovedLineDto {
  @IsString() lineId!: string;
  @IsInt() @Min(0) @Max(1_000_000) approvedQty!: number;
}
export class ApproveDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ApprovedLineDto)
  lines?: ApprovedLineDto[];
}
export class NoteDto {
  @IsString() @MinLength(3, { message: 'اكتب سبباً واضحاً' }) note!: string;
}
export class ListQuery {
  @IsOptional() @IsEnum(RequestStatus) status?: RequestStatus;
}

const FULL_INCLUDE = {
  requester: { select: { id: true, fullName: true } },
  department: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  lines: { include: { item: { include: { category: true } } } },
  events: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { fullName: true, role: true } } } },
  purchaseRequests: { select: { id: true, number: true, status: true } },
} satisfies Prisma.RequestInclude;

const ISSUABLE: RequestStatus[] = ['PENDING_WAREHOUSE', 'AWAITING_PURCHASE', 'PARTIALLY_ISSUED'];

/* --------------------------- Service ---------------------------- */
@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService, private readonly replenishment: ReplenishmentService) {}

  /** نطاق الرؤية حسب الدور (RBAC على مستوى البيانات). */
  private scope(user: AuthUser): Prisma.RequestWhereInput {
    switch (user.role) {
      case Role.ADMIN: return {};
      case Role.WAREHOUSE_KEEPER:
        return { OR: [{ status: { in: ['PENDING_WAREHOUSE', 'AWAITING_PURCHASE', 'PARTIALLY_ISSUED', 'ISSUED'] } }, { requesterId: user.id }] };
      case Role.DEPT_MANAGER:
        return { OR: [{ departmentId: user.departmentId ?? '__none__' }, { requesterId: user.id }] };
      case Role.BRANCH_MANAGER:
        return { OR: [{ branchId: user.branchId ?? '__none__' }, { requesterId: user.id }] };
      default: return requesterScope(user);
    }
  }

  list(user: AuthUser, status?: RequestStatus) {
    return this.prisma.request.findMany({
      where: { AND: [this.scope(user), status ? { status } : {}] },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        requester: { select: { fullName: true } },
        department: { select: { name: true } },
        branch: { select: { name: true } },
        section: { select: { name: true } },
        lines: { select: { quantity: true } },
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const r = await this.prisma.request.findFirst({
      where: { AND: [{ id }, this.scope(user)] },
      include: FULL_INCLUDE,
    });
    if (!r) throw new NotFoundException('الطلب غير موجود');
    return r;
  }

  private async assertItemsActive(lines: RequestLineDto[]) {
    const ids = [...new Set(lines.map((l) => l.itemId))];
    if (ids.length !== lines.length) throw new BadRequestException('الصنف مكرر في الطلب');
    const found = await this.prisma.item.count({ where: { id: { in: ids }, active: true } });
    if (found !== ids.length) throw new BadRequestException('يوجد صنف غير صالح أو موقوف');
  }

  async create(user: AuthUser, dto: SaveRequestDto) {
    // الرافع مربوط بفرع أو إدارة (أو الاثنين)؛ ما لا يملكه يختاره في النموذج، فيكتمل الاثنان دائماً
    const departmentId = user.departmentId ?? dto.departmentId;
    const branchId = user.branchId ?? dto.branchId;
    if (!departmentId || !branchId) throw new BadRequestException('اختر الفرع والإدارة');
    const [d, b] = await Promise.all([
      this.prisma.department.count({ where: { id: departmentId } }),
      this.prisma.branch.count({ where: { id: branchId } }),
    ]);
    if (!d || !b) throw new BadRequestException('الإدارة أو الفرع غير موجود');
    if (dto.sectionId && !(await this.prisma.section.count({ where: { id: dto.sectionId } }))) throw new BadRequestException('القسم غير موجود');
    await this.assertItemsActive(dto.lines);
    // طلب مدير الإدارة نفسه يُعتمد تلقائياً ويذهب للمستودع.
    const auto = user.role === Role.DEPT_MANAGER || user.role === Role.BRANCH_MANAGER;
    return retryOnUnique(() => this.prisma.$transaction(async (tx) => tx.request.create({
      data: {
        number: await nextNumber(tx, 'request'),
        requesterId: user.id, departmentId, branchId, sectionId: dto.sectionId || null,
        justification: dto.justification,
        status: auto ? 'PENDING_WAREHOUSE' : 'PENDING_MANAGER',
        lines: { create: dto.lines.map((l) => ({ ...l, approvedQty: auto ? l.quantity : null })) },
        events: {
          create: [
            { actorId: user.id, action: 'SUBMITTED' },
            ...(auto ? [{ actorId: user.id, action: 'APPROVED', note: 'اعتماد تلقائي: الطالب هو مدير الإدارة' }] : []),
          ],
        },
      },
      include: FULL_INCLUDE,
    })));
  }

  async update(user: AuthUser, id: string, dto: SaveRequestDto) {
    const r = await this.prisma.request.findUnique({ where: { id } });
    if (!r || r.requesterId !== user.id) throw new NotFoundException('الطلب غير موجود');
    if (r.status !== 'NEEDS_EDIT') throw new ConflictException('لا يمكن تعديل الطلب إلا بعد إعادته من المدير');
    await this.assertItemsActive(dto.lines);
    return this.prisma.$transaction(async (tx) => {
      await tx.requestLine.deleteMany({ where: { requestId: id } });
      return tx.request.update({
        where: { id },
        data: {
          justification: dto.justification, status: 'PENDING_MANAGER',
          lines: { create: dto.lines },
          events: { create: { actorId: user.id, action: 'RESUBMITTED' } },
        },
        include: FULL_INCLUDE,
      });
    });
  }

  /** حذف طلب نهائياً (سوبر أدمن). إن كان قد صُرف منه تُعاد الكميات إلى دفعاتها قبل الحذف. */
  async remove(id: string) {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: { issues: { include: { allocations: true } } },
    });
    if (!req) throw new NotFoundException('الطلب غير موجود');

    await this.prisma.$transaction(async (tx) => {
      for (const issue of req.issues) {
        for (const a of issue.allocations) {
          await tx.stockBatch.update({ where: { id: a.batchId }, data: { qtyRemaining: { increment: a.quantity } } });
        }
        await tx.issueAllocation.deleteMany({ where: { issueId: issue.id } });
      }
      await tx.stockIssue.deleteMany({ where: { requestId: id } });

      // طلبات الشراء الناتجة عن هذا الطلب: تُحذف، وإن ارتبطت بها فاتورة يُفك الارتباط فقط
      const prs = await tx.purchaseRequest.findMany({ where: { requestId: id }, include: { invoices: { select: { id: true } } } });
      for (const pr of prs) {
        if (pr.invoices.length) await tx.purchaseRequest.update({ where: { id: pr.id }, data: { requestId: null } });
        else await tx.purchaseRequest.delete({ where: { id: pr.id } });
      }

      await tx.requestEvent.deleteMany({ where: { requestId: id } });
      await tx.requestLine.deleteMany({ where: { requestId: id } });
      await tx.request.delete({ where: { id } });
    }, LONG_TX);
    await this.replenishment.safeSync();
    return { ok: true };
  }

  async cancel(user: AuthUser, id: string) {
    const r = await this.prisma.request.findUnique({ where: { id } });
    if (!r || r.requesterId !== user.id) throw new NotFoundException('الطلب غير موجود');
    if (r.status !== 'PENDING_MANAGER' && r.status !== 'NEEDS_EDIT') {
      throw new ConflictException('لا يمكن إلغاء الطلب بعد اعتماده');
    }
    return this.transition(id, user, 'CANCELLED', 'CANCELLED');
  }

  /** يتحقق أن المدير يملك صلاحية على إدارة الطلب وأن الطلب بانتظاره. */
  private async managerTarget(user: AuthUser, id: string) {
    const r = await this.prisma.request.findUnique({ where: { id }, include: { lines: true } });
    if (!r) throw new NotFoundException('الطلب غير موجود');
    const inScope = user.role === Role.ADMIN
      || (user.role === Role.DEPT_MANAGER && r.departmentId === user.departmentId)
      || (user.role === Role.BRANCH_MANAGER && r.branchId === user.branchId);
    if (!inScope) throw new ForbiddenException('الطلب خارج نطاق صلاحيتك');
    if (r.requesterId === user.id && user.role !== Role.ADMIN) throw new ForbiddenException('لا يمكنك اعتماد طلبك بنفسك');
    if (r.status !== 'PENDING_MANAGER') throw new ConflictException('الطلب ليس بانتظار قرار المدير');
    return r;
  }

  async approve(user: AuthUser, id: string, dto: ApproveDto) {
    const r = await this.managerTarget(user, id);
    const overrides = new Map((dto.lines ?? []).map((l) => [l.lineId, l.approvedQty]));
    for (const lid of overrides.keys()) {
      if (!r.lines.some((l) => l.id === lid)) throw new BadRequestException('سطر غير تابع للطلب');
    }
    const finals = r.lines.map((l) => ({ id: l.id, qty: overrides.get(l.id) ?? l.quantity, max: l.quantity }));
    if (finals.some((f) => f.qty > f.max)) throw new BadRequestException('الكمية المعتمدة أكبر من المطلوبة');
    if (finals.every((f) => f.qty === 0)) throw new BadRequestException('لا يمكن اعتماد طلب بكميات صفرية؛ ارفضه بدلاً من ذلك');

    return this.prisma.$transaction(async (tx) => {
      for (const f of finals) {
        await tx.requestLine.update({ where: { id: f.id }, data: { approvedQty: f.qty } });
      }
      return tx.request.update({
        where: { id },
        data: {
          status: 'PENDING_WAREHOUSE',
          events: { create: { actorId: user.id, action: 'APPROVED', note: dto.note } },
        },
        include: FULL_INCLUDE,
      });
    });
  }

  async reject(user: AuthUser, id: string, dto: NoteDto) {
    await this.managerTarget(user, id);
    return this.transition(id, user, 'REJECTED', 'REJECTED', dto.note);
  }

  async returnForEdit(user: AuthUser, id: string, dto: NoteDto) {
    await this.managerTarget(user, id);
    return this.transition(id, user, 'NEEDS_EDIT', 'RETURNED', dto.note);
  }

  private transition(id: string, user: AuthUser, status: RequestStatus, action: string, note?: string) {
    return this.prisma.request.update({
      where: { id },
      data: { status, events: { create: { actorId: user.id, action, note } } },
      include: FULL_INCLUDE,
    });
  }

  /**
   * الصرف من المستودع بنظام FIFO.
   * - يصرف ما يتوفر من كل سطر (المعتمد − المصروف سابقاً) من أقدم الدفعات.
   * - الباقي يتحول تلقائياً إلى طلب شراء (أو يُحدَّث الطلب المفتوح).
   * - قابل للإعادة بعد وصول فاتورة الشراء.
   */
  async issue(user: AuthUser, id: string) {
    let req = await this.prisma.request.findUnique({ where: { id }, include: { lines: true } });
    if (!req) throw new NotFoundException('الطلب غير موجود');

    // السوبر أدمن يتخطى الاعتماد: يُعتمد الطلب بكمياته المطلوبة ثم يُصرف مباشرة
    if (user.role === Role.ADMIN && (req.status === 'PENDING_MANAGER' || req.status === 'NEEDS_EDIT')) {
      const lines = req.lines;
      await this.prisma.$transaction(async (tx) => {
        for (const l of lines) await tx.requestLine.update({ where: { id: l.id }, data: { approvedQty: l.quantity } });
        await tx.request.update({
          where: { id },
          data: {
            status: 'PENDING_WAREHOUSE',
            events: { create: { actorId: user.id, action: 'APPROVED', note: 'تخطّي الاعتماد: السوبر أدمن' } },
          },
        });
      });
      req = await this.prisma.request.findUnique({ where: { id }, include: { lines: true } });
      if (!req) throw new NotFoundException('الطلب غير موجود');
    }

    if (!ISSUABLE.includes(req.status)) throw new ConflictException('الطلب غير جاهز للصرف');

    const snapshot = req; // الأسطر قرئت قبل المعاملة؛ نتأكد داخلها أن الطلب لم يتغير (وإلا صُرف مرتين)
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.request.updateMany({
        where: { id, updatedAt: snapshot.updatedAt, status: { in: ISSUABLE } },
        data: { updatedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('الطلب صُرف أو تغيّر للتو، حدّث الصفحة وأعد المحاولة');

      const shortages: { itemId: string; quantity: number }[] = [];
      const issue = await tx.stockIssue.create({ data: { requestId: id, issuedById: user.id } });
      let issuedNow = 0;

      for (const line of req.lines) {
        const need = (line.approvedQty ?? 0) - line.issuedQty;
        if (need <= 0) continue;
        const batches = await tx.stockBatch.findMany({
          where: { itemId: line.itemId, qtyRemaining: { gt: 0 } },
          orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
        });
        const { allocations, shortage } = allocateFifo(batches, need);

        for (const a of allocations) {
          // خصم مشروط يمنع السحب المزدوج عند تزامن عمليتي صرف.
          const res = await tx.stockBatch.updateMany({
            where: { id: a.batchId, qtyRemaining: { gte: a.quantity } },
            data: { qtyRemaining: { decrement: a.quantity } },
          });
          if (res.count !== 1) throw new ConflictException('تغيّر المخزون أثناء الصرف، أعد المحاولة');
          await tx.issueAllocation.create({
            data: { issueId: issue.id, batchId: a.batchId, itemId: line.itemId, quantity: a.quantity, unitCost: a.unitCost },
          });
          issuedNow += a.quantity;
        }
        const got = need - shortage;
        if (got > 0) await tx.requestLine.update({ where: { id: line.id }, data: { issuedQty: { increment: got } } });
        if (shortage > 0) shortages.push({ itemId: line.itemId, quantity: shortage });
      }

      if (issuedNow === 0) await tx.stockIssue.delete({ where: { id: issue.id } });

      // طلب الشراء المفتوح لهذا الطلب (إن وجد) يُحدَّث ليطابق العجز الحالي.
      const openPr = await tx.purchaseRequest.findFirst({
        where: { requestId: id, status: { in: ['OPEN', 'ORDERED'] } },
      });
      if (shortages.length > 0) {
        if (openPr) {
          await tx.purchaseRequestLine.deleteMany({ where: { purchaseRequestId: openPr.id } });
          await tx.purchaseRequestLine.createMany({
            data: shortages.map((s) => ({ ...s, purchaseRequestId: openPr.id })),
          });
        } else {
          // العجز قد يكون مغطى بطلب مجمّع نشط ضُمّ إليه طلب الشراء الأصلي
          const coveredByMerge = await tx.purchaseRequest.findFirst({
            where: { requestId: id, mergedInto: { status: { in: ['OPEN', 'ORDERED'] } } },
          });
          if (!coveredByMerge) {
            await tx.purchaseRequest.create({
              data: { number: await nextNumber(tx, 'purchase'), requestId: id, lines: { create: shortages } },
            });
          }
        }
      } else if (openPr) {
        await tx.purchaseRequest.update({ where: { id: openPr.id }, data: { status: 'RECEIVED' } });
      }

      const everIssued = req.lines.some((l) => l.issuedQty > 0) || issuedNow > 0;
      const status: RequestStatus =
        shortages.length === 0 ? 'ISSUED' : everIssued ? 'PARTIALLY_ISSUED' : 'AWAITING_PURCHASE';
      await tx.request.update({
        where: { id },
        data: {
          status,
          events: {
            create: {
              actorId: user.id, action: 'ISSUED',
              note: shortages.length ? 'صرف جزئي، الباقي حُوّل إلى طلب شراء' : undefined,
            },
          },
        },
      });
    }, LONG_TX);

    // الصرف خفّض المخزون: قد يصل صنف إلى حده الأدنى فيُنشأ طلب شراء تلقائي
    await this.replenishment.safeSync();
    return this.get(user, id);
  }
}

/* -------------------------- Controller -------------------------- */
@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) { return this.svc.list(u, q.status); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.get(u, id); }

  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: SaveRequestDto) { return this.svc.create(u, dto); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SaveRequestDto) {
    return this.svc.update(u, id, dto);
  }
  @Post(':id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.cancel(u, id); }

  @Post(':id/approve') @Roles(Role.DEPT_MANAGER, Role.BRANCH_MANAGER)
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ApproveDto) { return this.svc.approve(u, id, dto); }
  @Post(':id/reject') @Roles(Role.DEPT_MANAGER, Role.BRANCH_MANAGER)
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: NoteDto) { return this.svc.reject(u, id, dto); }
  @Post(':id/return') @Roles(Role.DEPT_MANAGER, Role.BRANCH_MANAGER)
  returnForEdit(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: NoteDto) { return this.svc.returnForEdit(u, id, dto); }

  @Post(':id/issue') @Roles(Role.WAREHOUSE_KEEPER)
  issue(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.issue(u, id); }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}

@Module({ imports: [PurchaseRequestsModule], controllers: [RequestsController], providers: [RequestsService] })
export class RequestsModule {}
