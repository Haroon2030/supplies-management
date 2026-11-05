'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PurchaseRequestRow } from '@/lib/types';
import type { Tone } from '@/lib/utils';

const tone: Record<PurchaseRequestRow['status'], Tone> = { OPEN: 'accent', ORDERED: 'info', RECEIVED: 'ok', CANCELLED: 'muted' };

export default function PurchaseRequestsPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['purchase-requests'], queryFn: () => api<PurchaseRequestRow[]>('/purchase-requests'), refetchInterval: 30_000 });
  const pg = usePagination(q.data ?? []);
  const ordered = useMutation({
    mutationFn: (id: string) => api(`/purchase-requests/${id}/ordered`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['purchase-requests'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title={t('navPurchase')} />
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <Card><EmptyState title={t('emptyPR')} /></Card>
      ) : (
        <>
        <div className="grid gap-4 lg:grid-cols-2">
          {pg.slice.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold tabular-nums">#{p.number}</p>
                  {p.request ? (
                    <Link href={`/requests/${p.request.id}`} className="text-sm text-accent-soft hover:underline">
                      {t('forRequest')} {p.request.number} · {p.request.department.name} · {p.request.branch.name}
                    </Link>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm text-warn"><Zap className="size-3.5" aria-hidden /> {t('autoReorder')}</p>
                  )}
                  <p className="text-xs text-muted">{fmt.date(p.createdAt)}</p>
                </div>
                <Badge tone={tone[p.status]}>{t(`pr_${p.status}`)}</Badge>
              </div>
              <ul className="my-4 divide-y divide-line/60">
                {p.lines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{l.item.name}</span>
                    <span className="font-semibold tabular-nums">{fmt.num(l.quantity)} <span className="text-xs font-normal text-muted">{l.item.unit}</span></span>
                  </li>
                ))}
              </ul>
              {(p.status === 'OPEN' || p.status === 'ORDERED') && (
                <div className="flex flex-wrap gap-2">
                  {p.status === 'OPEN' && <Button variant="glass" size="sm" loading={ordered.isPending && ordered.variables === p.id} onClick={() => ordered.mutate(p.id)}>{t('markOrdered')}</Button>}
                  <Button size="sm" asChild><Link href={`/invoices?pr=${p.id}`}>{t('registerInvoice')}</Link></Button>
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card className="mt-4"><Pagination {...pg} onPage={pg.setPage} /></Card>
        </>
      )}
    </>
  );
}
