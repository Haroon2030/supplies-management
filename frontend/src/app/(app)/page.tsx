'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, Boxes, CheckCircle2, ClipboardList, Loader, ShoppingCart, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { Donut, RankBars, TrendChart, WeeklyBars } from '@/components/charts';
import { KanbanBoard } from '@/components/kanban';
import { Badge, Card, CardHeader, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Dashboard, RequestRow } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, fmt, dir, lang } = useI18n();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 30_000 });
  const reqs = useQuery({ queryKey: ['requests'], queryFn: () => api<RequestRow[]>('/requests'), refetchInterval: 30_000 });

  if (!user) return null;
  if (dash.isLoading) return <Spinner />;
  if (dash.isError || !dash.data) return <ErrorState error={dash.error} onRetry={() => dash.refetch()} />;
  const d = dash.data;
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const isStock = !!d.inventory;
  const p = d.pipeline;

  // تغيّر الشهر الحالي عن السابق
  const ym = (offset: number) => { const x = new Date(); x.setMonth(x.getMonth() + offset, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const thisMonth = d.trend.find((x) => x.month === ym(0))?.requests ?? 0;
  const lastMonth = d.trend.find((x) => x.month === ym(-1))?.requests ?? 0;
  const delta = thisMonth - lastMonth;

  const inProgress = p.pendingManager + p.pendingWarehouse + p.awaitingPurchase + p.needsEdit;
  const active = d.total - d.cancelled;
  const attention = user.role === 'DEPT_MANAGER' || user.role === 'BRANCH_MANAGER' ? { n: p.pendingManager, stage: 'manager' }
    : user.role === 'WAREHOUSE_KEEPER' ? { n: p.pendingWarehouse, stage: 'warehouse' }
    : user.role === 'EMPLOYEE' ? { n: p.needsEdit, stage: 'edit' } : { n: p.awaitingPurchase, stage: 'purchase' };
  const pct = (n: number) => (active ? Math.round((n / active) * 100) : 0);

  const wd = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' });
  const weekly = d.weekly.map((w, i, a) => ({ label: wd.format(new Date(`${w.day}T00:00:00`)), requests: w.requests, today: i === a.length - 1 }));
  const weekTotal = d.weekly.reduce((s, w) => s + w.requests, 0);

  return (
    <div className="space-y-5">
      {user.role === 'EMPLOYEE' && p.needsEdit > 0 && (
        <Link href="/requests?stage=edit" className="glass flex items-center gap-3 rounded-[22px] px-5 py-3.5 text-sm hover:bg-white/10">
          <AlertTriangle className="size-4 text-plum" aria-hidden />
          <span className="flex-1">{t('needsEditBanner')} ({fmt.num(p.needsEdit)})</span>
          <Arrow className="size-4" aria-hidden />
        </Link>
      )}

      {/* 1) مؤشرات الطلبات */}
      <section aria-label={t('navRequests')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={ClipboardList} tone="accent" label={t('kpiTotal')} value={fmt.num(d.total)} href="/requests"
          sub={<span className={cn('inline-flex items-center gap-1', delta >= 0 ? 'text-ok' : 'text-bad')}>
            {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {delta >= 0 ? '+' : ''}{fmt.num(delta)} {t('vsLastMonth')}</span>} />
        <Kpi icon={CheckCircle2} tone="ok" label={t('kpiDone')} value={fmt.num(p.issued)} href="/requests?stage=issued"
          sub={<span className="text-muted">{pct(p.issued)}% {t('ofTotalPct')}</span>} />
        <Kpi icon={Loader} tone="warn" label={t('kpiProgress')} value={fmt.num(inProgress)} href="/requests"
          sub={<span className="text-muted">{pct(inProgress)}% {t('ofTotalPct')}</span>} />
        <Kpi icon={AlertTriangle} tone="bad" label={user.role === 'ADMIN' ? t('kpiAttentionAdmin') : t('kpiAttention')} value={fmt.num(attention.n)} href={`/requests?stage=${attention.stage}`}
          sub={<span className={attention.n ? 'text-bad' : 'text-ok'}>{attention.n ? '●' : '✓'}</span>} />
      </section>

      {/* 2) مؤشرات المخزون (أمين المستودع والمدير العام) */}
      {isStock && d.inventory && (
        <section aria-label={t('navInventory')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Wallet} tone="accent" label={t('stockValue')} value={fmt.money(d.inventory.value)} />
          <Kpi icon={Boxes} tone="ok" label={t('stockUnits')} value={fmt.num(d.inventory.units)} />
          <Kpi icon={AlertTriangle} tone={d.inventory.lowCount ? 'bad' : 'ok'} label={t('lowItems')} value={fmt.num(d.inventory.lowCount)} href="/inventory" />
          <Kpi icon={ShoppingCart} tone="plum" label={t('openPR')} value={fmt.num(d.inventory.openPurchaseRequests)} href="/purchase-requests" />
        </section>
      )}

      {/* 3) لوحة الطلبات بعرض كامل */}
      <KanbanBoard rows={reqs.data} loading={reqs.isLoading} canCreate />

      {/* 4) ثلاث بطاقات متساوية: الإنجاز · الأسبوع · الفئات */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="h-full p-5">
          <h2 className="mb-4 text-[17px] font-semibold">{t('progressTitle')}</h2>
          <div className="grow-in"><Donut done={p.issued} total={active} label={t('completedWord')} /></div>
          <div className="mt-4 flex items-center justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />{t('completedWord')} {pct(p.issued)}%</span>
            <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full bg-white/25" />{t('remainingWord')} {100 - pct(p.issued)}%</span>
          </div>
          <p className="mt-3 text-center text-xs text-muted tabular-nums">{fmt.num(p.issued)} {t('completedOf')} {fmt.num(active)}</p>
        </Card>

        <Card className="h-full p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold">{t('weeklyTitle')}</h2>
            <span className="text-sm font-semibold tabular-nums text-info">{fmt.num(weekTotal)}</span>
          </div>
          <WeeklyBars data={weekly} />
        </Card>

        <Card className="h-full">
          <CardHeader title={t('unitsByCategory')} />
          <div className="p-3 pt-2">{d.byCategory.length ? <RankBars data={d.byCategory} label="category" value="units" /> : <EmptyState title={t('none')} />}</div>
        </Card>
      </section>

      {/* 5) الاتجاه خلال 6 أشهر بعرض كامل */}
      <Card>
        <CardHeader title={t('requestsPerMonth')} />
        <div className="p-3 pt-2"><TrendChart data={d.trend.map((r) => ({ ...r, label: fmt.month(r.month) }))} x="label" y="requests" /></div>
      </Card>

      {/* 6) المخزون والفواتير جنباً إلى جنب */}
      {isStock && d.inventory && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="h-full">
            <CardHeader title={t('lowStockTitle')} />
            <ul className="p-2">
              {d.lowItems?.length ? d.lowItems.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <Badge tone={i.onHand === 0 ? 'bad' : 'warn'}>{fmt.num(i.onHand)} / {fmt.num(i.minStock)}</Badge>
                </li>
              )) : <p className="px-3 py-6 text-center text-sm text-muted">{t('nothingLow')}</p>}
            </ul>
          </Card>
          <Card className="h-full">
            <CardHeader title={t('latestInvoices')} action={<Link href="/invoices" className="text-sm text-accent-soft hover:underline">{t('navInvoices')}</Link>} />
            <ul className="p-2">
              {d.lastInvoices?.length ? d.lastInvoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" dir="ltr">{i.number}</p>
                    <p className="truncate text-xs text-muted">{i.supplier} · {fmt.date(i.date)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{fmt.money(i.total)}</span>
                </li>
              )) : <p className="px-3 py-6 text-center text-sm text-muted">{t('none')}</p>}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  accent: 'bg-accent/20 text-accent-soft', ok: 'bg-ok/20 text-ok', warn: 'bg-warn/20 text-warn', bad: 'bg-bad/20 text-bad', plum: 'bg-plum/20 text-plum',
};

function Kpi({ icon: Icon, label, value, sub, tone, href, compact }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; sub?: React.ReactNode; tone: keyof typeof TONE; href?: string; compact?: boolean;
}) {
  const body = (
    <Card className={cn('h-full p-4 transition-colors', href && 'hover:bg-white/10', compact && 'p-3.5')}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', TONE[tone])} aria-hidden><Icon className="size-4" /></span>
      </div>
      <p className={cn('mt-2 font-bold tabular-nums tracking-tight', compact ? 'text-xl' : 'text-[32px] leading-none')}>{value}</p>
      {sub && <p className="mt-2 text-xs">{sub}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
