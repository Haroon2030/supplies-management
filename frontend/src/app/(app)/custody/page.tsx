'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CustodyReceiptDialog } from '@/components/custody-receipt';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Row {
  id: string; number: number; status: 'PENDING' | 'SIGNED'; createdAt: string; unitsCount: number; total: number;
  custodian: { fullName: string };
  request: { number: number; department: { name: string }; branch: { name: string } };
}

export default function CustodyPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['custody'], queryFn: () => api<Row[]>('/custody'), refetchInterval: 30_000 });
  const [viewing, setViewing] = useState<string | null>(null);
  const pg = usePagination(q.data ?? []);

  return (
    <>
      <PageHeader title={t('navCustody')} subtitle={t('custodyHint')} />
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title={t('custodyEmpty')} /> : (
          <TableWrap>
            <thead><tr>
              <th className={th}>{t('custodyNo')}</th><th className={th}>{t('date')}</th><th className={th}>{t('custodyCustodian')}</th>
              <th className={th}>{t('branch')}</th><th className={th}>{t('department')}</th><th className={th}>{t('supplyItems')}</th>
              <th className={th}>{t('custodyTotal')}</th><th className={th}>{t('status')}</th>
            </tr></thead>
            <tbody>
              {pg.slice.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-white/5" onClick={() => setViewing(r.id)}>
                  <td className={cn(td, 'font-semibold tabular-nums')} dir="ltr">C-{r.number}</td>
                  <td className={cn(td, 'tabular-nums')}>{fmt.date(r.createdAt)}</td>
                  <td className={td}>{r.custodian.fullName}</td>
                  <td className={td}>{r.request.branch.name.trim()}</td>
                  <td className={td}>{r.request.department.name.trim()}</td>
                  <td className={cn(td, 'tabular-nums')}>{fmt.num(r.unitsCount)}</td>
                  <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{fmt.money2(r.total)}</td>
                  <td className={td}><Badge tone={r.status === 'SIGNED' ? 'ok' : 'warn'}>{t(r.status === 'SIGNED' ? 'custodySigned' : 'custodyPending')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {viewing && <CustodyReceiptDialog id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
