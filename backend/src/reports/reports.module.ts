import { Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { requesterScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

const num = (v: unknown) => Number(v ?? 0);
const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayKey = (d: Date) => `${monthKey(d)}-${pad(d.getDate())}`;

const validDate = (v?: string) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };

function range(from?: string, to?: string) {
  const end = validDate(to) ?? new Date();
  const start = validDate(from) ?? new Date(end.getFullYear(), end.getMonth() - 5, 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** يجمع عدّاً/مجموعاً حسب مفتاح، ثم يُرتَّب ويقطع. التجميع في الذاكرة يُبقي التقارير مستقلة عن نوع قاعدة البيانات. */
function tally<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** الأكثر طلباً: المستخدمون. */
  async topRequesters(from?: string, to?: string, dept?: string) {
    const { start, end } = range(from, to);
    const rows = await this.prisma.request.findMany({
      where: { createdAt: { gte: start, lte: end }, ...(dept ? { departmentId: dept } : {}) },
      select: {
        requesterId: true, requester: { select: { fullName: true } }, department: { select: { name: true } },
        lines: { select: { quantity: true } },
      },
    });
    return [...tally(rows, (r) => r.requesterId).values()]
      .map((g) => ({
        name: g[0].requester.fullName, department: g[0].department.name, requests: g.length,
        units: g.reduce((s, r) => s + r.lines.reduce((a, l) => a + l.quantity, 0), 0),
      }))
      .sort((a, b) => b.requests - a.requests || b.units - a.units)
      .slice(0, 10);
  }

  /** الأصناف الأكثر طلباً. */
  async topItems(from?: string, to?: string, dept?: string) {
    const { start, end } = range(from, to);
    const rows = await this.prisma.requestLine.findMany({
      where: { request: { createdAt: { gte: start, lte: end }, ...(dept ? { departmentId: dept } : {}) } },
      select: { itemId: true, quantity: true, issuedQty: true, item: { select: { name: true, category: { select: { name: true } } } } },
    });
    return [...tally(rows, (r) => r.itemId).values()]
      .map((g) => ({
        name: g[0].item.name, category: g[0].item.category.name,
        requested: g.reduce((s, r) => s + r.quantity, 0), issued: g.reduce((s, r) => s + r.issuedQty, 0),
      }))
      .sort((a, b) => b.requested - a.requested)
      .slice(0, 10);
  }

  /** الإدارات بحسب نسبة الاعتماد (التعميم): معتمد / مرفوض / معاد. اعتماد المدير لطلب نفسه لا يُحسب. */
  async departmentApprovals(from?: string, to?: string, dept?: string) {
    const { start, end } = range(from, to);
    const rows = await this.prisma.requestEvent.findMany({
      where: {
        action: { in: ['APPROVED', 'REJECTED', 'RETURNED'] }, createdAt: { gte: start, lte: end },
        ...(dept ? { request: { departmentId: dept } } : {}),
      },
      select: {
        action: true, actorId: true,
        request: { select: { requesterId: true, departmentId: true, department: { select: { name: true } }, branch: { select: { name: true } } } },
      },
    });
    return [...tally(rows, (r) => r.request.departmentId).values()]
      .map((g) => ({
        department: g[0].request.department.name, branch: g[0].request.branch.name,
        approved: g.filter((r) => r.action === 'APPROVED' && r.actorId !== r.request.requesterId).length,
        rejected: g.filter((r) => r.action === 'REJECTED').length,
        returned: g.filter((r) => r.action === 'RETURNED').length,
      }))
      .sort((a, b) => b.approved - a.approved);
  }

  /** مشتريات الفروع (إجمالي الفواتير). */
  async branchPurchases(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const groups = await this.prisma.purchaseInvoice.groupBy({
      by: ['branchId'], where: { invoiceDate: { gte: start, lte: end } }, _sum: { total: true }, _count: true,
    });
    const branches = await this.prisma.branch.findMany({ select: { id: true, name: true } });
    return groups
      .map((g) => ({ branch: branches.find((b) => b.id === g.branchId)?.name ?? '—', invoices: g._count, total: num(g._sum.total) }))
      .sort((a, b) => b.total - a.total);
  }

  /** مشتريات شهرية. */
  async monthlyPurchases(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const rows = await this.prisma.purchaseInvoice.findMany({
      where: { invoiceDate: { gte: start, lte: end } }, select: { invoiceDate: true, total: true },
    });
    const m = new Map<string, number>();
    for (const r of rows) m.set(monthKey(r.invoiceDate), (m.get(monthKey(r.invoiceDate)) ?? 0) + num(r.total));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
  }

  /** المدير يرى تقارير إدارته فقط ولا يرى المشتريات؛ أمين المستودع والمدير العام يرون الكل. */
  async all(user: AuthUser, from?: string, to?: string) {
    const dept = user.role === Role.DEPT_MANAGER ? user.departmentId ?? '__none__' : undefined;
    const [topRequesters, topItems, departmentApprovals, branchPurchases, monthlyPurchases] = await Promise.all([
      this.topRequesters(from, to, dept), this.topItems(from, to, dept), this.departmentApprovals(from, to, dept),
      dept ? Promise.resolve([]) : this.branchPurchases(from, to),
      dept ? Promise.resolve([]) : this.monthlyPurchases(from, to),
    ]);
    return { topRequesters, topItems, departmentApprovals, branchPurchases, monthlyPurchases };
  }

  /* ------------------------------ Dashboard ------------------------------ */

  /** لوحة تتغير بحسب الدور: الموظف/المدير/أمين المستودع/المدير العام. */
  async dashboard(user: AuthUser) {
    const scope: Prisma.RequestWhereInput =
      user.role === Role.EMPLOYEE ? requesterScope(user)
      : user.role === Role.DEPT_MANAGER ? { departmentId: user.departmentId ?? '__none__' }
      : user.role === Role.BRANCH_MANAGER ? { branchId: user.branchId ?? '__none__' }
      : {};

    const byStatus = await this.prisma.request.groupBy({ by: ['status'], where: scope, _count: true });
    const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>;
    // "بحاجة لتعديل" تخص صاحب الطلب وحده حتى لو رأى الرافع طلبات فرعه/إدارته
    const needsEditCount = user.role === Role.EMPLOYEE
      ? await this.prisma.request.count({ where: { requesterId: user.id, status: 'NEEDS_EDIT' } })
      : counts.NEEDS_EDIT ?? 0;

    // آخر 6 أشهر (للمنحنى والفئات) وآخر 7 أيام (للأعمدة الأسبوعية)
    const since = new Date(); since.setMonth(since.getMonth() - 5, 1); since.setHours(0, 0, 0, 0);
    const recent = await this.prisma.request.findMany({
      where: { ...scope, createdAt: { gte: since } },
      select: { createdAt: true, lines: { select: { quantity: true, item: { select: { category: { select: { name: true } } } } } } },
    });

    const months: string[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i, 1); months.push(monthKey(d)); }
    const trend = months.map((month) => ({ month, requests: recent.filter((r) => monthKey(r.createdAt) === month).length }));

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(dayKey(d)); }
    const weekly = days.map((day) => ({ day, requests: recent.filter((r) => dayKey(r.createdAt) === day).length }));

    const catUnits = new Map<string, number>();
    for (const r of recent) for (const l of r.lines) {
      const c = l.item.category.name;
      catUnits.set(c, (catUnits.get(c) ?? 0) + l.quantity);
    }
    const byCategory = [...catUnits.entries()].map(([category, units]) => ({ category, units })).sort((a, b) => b.units - a.units);

    const base = {
      role: user.role,
      total: byStatus.reduce((s, x) => s + x._count, 0),
      cancelled: counts.CANCELLED ?? 0,
      weekly,
      pipeline: {
        pendingManager: counts.PENDING_MANAGER ?? 0,
        needsEdit: needsEditCount,
        pendingWarehouse: counts.PENDING_WAREHOUSE ?? 0,
        awaitingPurchase: (counts.AWAITING_PURCHASE ?? 0) + (counts.PARTIALLY_ISSUED ?? 0),
        issued: counts.ISSUED ?? 0,
        rejected: counts.REJECTED ?? 0,
      },
      trend, byCategory,
    };

    if (user.role === Role.WAREHOUSE_KEEPER || user.role === Role.ADMIN) {
      const [batches, lowItems, openPr, lastInvoices] = await Promise.all([
        this.prisma.stockBatch.findMany({ where: { qtyRemaining: { gt: 0 } }, select: { itemId: true, qtyRemaining: true, unitCost: true } }),
        this.prisma.item.findMany({ where: { active: true }, select: { id: true, name: true, sku: true, minStock: true } }),
        this.prisma.purchaseRequest.count({ where: { status: { in: ['OPEN', 'ORDERED'] } } }),
        this.prisma.purchaseInvoice.findMany({
          orderBy: { invoiceDate: 'desc' }, take: 5,
          include: { supplier: { select: { name: true } } },
        }),
      ]);
      const onHand = new Map<string, number>();
      let value = 0;
      for (const b of batches) {
        onHand.set(b.itemId, (onHand.get(b.itemId) ?? 0) + b.qtyRemaining);
        value += b.qtyRemaining * num(b.unitCost);
      }
      const low = lowItems
        .map((i) => ({ ...i, onHand: onHand.get(i.id) ?? 0 }))
        .filter((i) => i.onHand <= i.minStock)
        .sort((a, b) => a.onHand - b.onHand)
        .slice(0, 6);
      return {
        ...base,
        inventory: { value, units: [...onHand.values()].reduce((s, n) => s + n, 0), lowCount: low.length, openPurchaseRequests: openPr },
        lowItems: low,
        lastInvoices: lastInvoices.map((i) => ({ id: i.id, number: i.number, supplier: i.supplier.name, total: num(i.total), date: i.invoiceDate })),
      };
    }
    return base;
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser) { return this.svc.dashboard(u); }

  @Get('reports') @Roles(Role.WAREHOUSE_KEEPER, Role.DEPT_MANAGER)
  reports(@CurrentUser() u: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.all(u, from, to);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
