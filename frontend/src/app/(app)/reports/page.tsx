'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { RankBars, StackedBars, TrendChart } from '@/components/charts';
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Reports } from '@/lib/types';
import { downloadCsv } from '@/lib/utils';

export default function ReportsPage() {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const [range, setRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState(range);
  const q = useQuery({
    queryKey: ['reports', applied],
    queryFn: () => api<Reports>(`/reports?${new URLSearchParams(Object.entries(applied).filter(([, v]) => v)).toString()}`),
  });
  const r = q.data;
  const isManager = user?.role === 'DEPT_MANAGER';

  const Export = ({ name, rows }: { name: string; rows: (string | number)[][] }) => (
    <Button variant="ghost" size="sm" onClick={() => downloadCsv(`${name}.csv`, rows)} aria-label={`${t('exportCsv')}: ${name}`}>
      <Download className="size-4" /> CSV
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t('navReports')}
        actions={
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(range); }}>
            <label className="flex items-center gap-2 text-sm text-muted">{t('from')}
              <input className="field !w-auto" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">{t('to')}
              <input className="field !w-auto" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </label>
            <Button type="submit" variant="glass">{t('apply')}</Button>
          </form>
        }
      />

      {q.isLoading ? <Spinner /> : q.isError || !r ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('topRequesters')} action={<Export name="top-requesters" rows={[['name', 'department', 'requests', 'units'], ...r.topRequesters.map((x) => [x.name, x.department, x.requests, x.units])]} />} />
            {r.topRequesters.length === 0 ? <EmptyState title={t('none')} /> : (
              <TableWrap>
                <thead><tr><th className={th}>{t('requester')}</th><th className={th}>{t('department')}</th><th className={th}>{t('requestsN')}</th><th className={th}>{t('qty')}</th></tr></thead>
                <tbody>
                  {r.topRequesters.map((x, i) => (
                    <tr key={x.name} className="hover:bg-white/5">
                      <td className={`${td} font-medium`}>{i === 0 && <span className="me-2 text-accent-soft" aria-hidden>★</span>}{x.name}</td>
                      <td className={`${td} text-muted`}>{x.department}</td>
                      <td className={`${td} tabular-nums`}>{fmt.num(x.requests)}</td>
                      <td className={`${td} tabular-nums`}>{fmt.num(x.units)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader title={t('topItems')} action={<Export name="top-items" rows={[['item', 'category', 'requested', 'issued'], ...r.topItems.map((x) => [x.name, x.category, x.requested, x.issued])]} />} />
            <div className="p-3">{r.topItems.length ? <RankBars data={r.topItems} label="name" value="requested" /> : <EmptyState title={t('none')} />}</div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title={t('deptApprovals')}
              action={<Export name="department-approvals" rows={[['department', 'branch', 'approved', 'rejected', 'returned'], ...r.departmentApprovals.map((x) => [x.department, x.branch, x.approved, x.rejected, x.returned])]} />}
            />
            {r.departmentApprovals.length === 0 ? <EmptyState title={t('none')} /> : (
              <div className="grid gap-2 p-3 lg:grid-cols-[1.4fr_1fr]">
                <StackedBars
                  data={r.departmentApprovals.map((x) => ({ ...x, label: `${x.department} · ${x.branch}` }))}
                  x="label"
                  series={[
                    { key: 'approved', name: t('approvedN'), color: '#30d158' },
                    { key: 'returned', name: t('returnedN'), color: '#bf5af2' },
                    { key: 'rejected', name: t('rejectedN'), color: '#ff453a' },
                  ]}
                />
                <TableWrap>
                  <thead><tr><th className={th}>{t('department')}</th><th className={th}>{t('approvalRate')}</th></tr></thead>
                  <tbody>
                    {r.departmentApprovals.map((x) => {
                      const tot = x.approved + x.rejected + x.returned;
                      const pct = tot ? Math.round((x.approved / tot) * 100) : 0;
                      return (
                        <tr key={`${x.department}${x.branch}`}>
                          <td className={td}>{x.department}<span className="block text-xs text-muted">{x.branch}</span></td>
                          <td className={td}>
                            <div className="flex items-center gap-3">
                              <span className="w-10 font-semibold tabular-nums">{pct}%</span>
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10" aria-hidden><span className="block h-full rounded-full bg-ok" style={{ width: `${pct}%` }} /></span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              </div>
            )}
          </Card>

          {!isManager && (
            <>
              <Card>
                <CardHeader title={t('branchPurchases')} action={<Export name="branch-purchases" rows={[['branch', 'invoices', 'total'], ...r.branchPurchases.map((x) => [x.branch, x.invoices, x.total])]} />} />
                <div className="p-3">
                  {r.branchPurchases.length ? <RankBars data={r.branchPurchases} label="branch" value="total" fmt={fmt.money} /> : <EmptyState title={t('none')} />}
                </div>
                <ul className="border-t border-line px-5 py-3 text-sm">
                  {r.branchPurchases.map((b) => (
                    <li key={b.branch} className="flex justify-between py-1"><span>{b.branch} <span className="text-muted">· {fmt.num(b.invoices)} {t('invoicesN')}</span></span><b className="tabular-nums">{fmt.money(b.total)}</b></li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title={t('monthlyPurchases')} action={<Export name="monthly-purchases" rows={[['month', 'total'], ...r.monthlyPurchases.map((x) => [x.month, x.total])]} />} />
                <div className="p-3">
                  <TrendChart data={r.monthlyPurchases.map((m) => ({ ...m, label: fmt.month(m.month) }))} x="label" y="total" color="#30d158" fmt={fmt.money} />
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
