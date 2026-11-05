'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, type Key } from '@/lib/i18n';
import type { RequestRow, RequestStatus } from '@/lib/types';
import { cn, statusTone } from '@/lib/utils';

/** مراحل التصفية — تطابق السكة في لوحة التحكم. */
const STAGES: { id: string; label: Key; statuses: RequestStatus[] }[] = [
  { id: 'manager', label: 'stageManager', statuses: ['PENDING_MANAGER'] },
  { id: 'edit', label: 'st_NEEDS_EDIT', statuses: ['NEEDS_EDIT'] },
  { id: 'warehouse', label: 'stageWarehouse', statuses: ['PENDING_WAREHOUSE'] },
  { id: 'purchase', label: 'stagePurchase', statuses: ['AWAITING_PURCHASE', 'PARTIALLY_ISSUED'] },
  { id: 'issued', label: 'stageIssued', statuses: ['ISSUED'] },
  { id: 'rejected', label: 'st_REJECTED', statuses: ['REJECTED', 'CANCELLED'] },
];

export default function RequestsPage() {
  return <Suspense fallback={<Spinner />}><RequestsInner /></Suspense>;
}

function RequestsInner() {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const stage = useSearchParams().get('stage') ?? 'all';
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['requests'], queryFn: () => api<RequestRow[]>('/requests'), refetchInterval: 30_000 });

  const rows = useMemo(() => {
    const st = STAGES.find((s) => s.id === stage)?.statuses;
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (r) =>
        (!st || st.includes(r.status)) &&
        (!needle || `${r.number} ${r.requester.fullName} ${r.department.name}`.toLowerCase().includes(needle)),
    );
  }, [q.data, stage, search]);

  const pg = usePagination(rows, [stage, search]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of STAGES) m.set(s.id, (q.data ?? []).filter((r) => s.statuses.includes(r.status)).length);
    return m;
  }, [q.data]);

  const title = user?.role === 'EMPLOYEE' ? t('navMyRequests') : user?.role === 'DEPT_MANAGER' || user?.role === 'BRANCH_MANAGER' ? t('navApprovals')
    : user?.role === 'WAREHOUSE_KEEPER' ? t('navWarehouseQueue') : t('navRequests');

  return (
    <>
      <PageHeader
        title={title}
        actions={user && (
          <Button asChild><Link href="/requests/new">{t('newRequest')}</Link></Button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={stage === 'all'} onClick={() => router.replace('/requests')}>{t('all')} <span className="tabular-nums opacity-70">{fmt.num(q.data?.length ?? 0)}</span></Chip>
        {STAGES.filter((s) => (counts.get(s.id) ?? 0) > 0 || s.id === stage).map((s) => (
          <Chip key={s.id} active={stage === s.id} onClick={() => router.replace(`/requests?stage=${s.id}`)}>
            {t(s.label)} <span className="tabular-nums opacity-70">{fmt.num(counts.get(s.id) ?? 0)}</span>
          </Chip>
        ))}
        <input
          className="field ms-auto !w-56"
          type="search"
          placeholder={t('search')}
          aria-label={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={t('emptyRequests')} hint={t('emptyRequestsHint')} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>#</th><th className={th}>{t('requester')}</th><th className={th}>{t('department')}</th>
                <th className={th}>{t('itemsCount')}</th><th className={th}>{t('date')}</th><th className={th}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {pg.slice.map((r) => (
                <tr key={r.id} className="cursor-pointer transition-colors hover:bg-white/5" onClick={() => router.push(`/requests/${r.id}`)}>
                  <td className={cn(td, 'font-semibold tabular-nums')}>
                    <Link href={`/requests/${r.id}`} className="hover:text-accent-soft" onClick={(e) => e.stopPropagation()}>{r.number}</Link>
                  </td>
                  <td className={td}>{r.requester.fullName}</td>
                  <td className={td}><span>{r.department.name}</span> <span className="text-xs text-muted">· {r.branch.name}</span></td>
                  <td className={cn(td, 'tabular-nums')}>{fmt.num(r.lines.length)} <span className="text-xs text-muted">({fmt.num(r.lines.reduce((s, l) => s + l.quantity, 0))} {t('units')})</span></td>
                  <td className={cn(td, 'text-muted')}>{fmt.date(r.createdAt)}</td>
                  <td className={td}><Badge tone={statusTone[r.status]}>{t(`st_${r.status}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
        active ? 'bg-accent/18 text-accent-soft ring-accent/40' : 'text-muted ring-white/12 hover:bg-white/6 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
