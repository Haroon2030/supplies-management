'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Layers, Printer, Zap } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PurchaseRequestRow } from '@/lib/types';
import type { Tone } from '@/lib/utils';

const tone: Record<PurchaseRequestRow['status'], Tone> = { OPEN: 'accent', ORDERED: 'info', RECEIVED: 'ok', CANCELLED: 'muted' };

export default function PurchaseRequestsPage() {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api(`/purchase-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success(t('deletedOk')); void qc.invalidateQueries({ queryKey: ['purchase-requests'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const merge = useMutation({
    mutationFn: () => api<{ id: string }>('/purchase-requests/merge', { method: 'POST', json: {} }),
    onSuccess: async (r) => {
      toast.success(t('mergeDone'));
      await qc.invalidateQueries({ queryKey: ['purchase-requests'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      setViewing(r.id); // الوثيقة الموحّدة للطلب المجمّع
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const q = useQuery({ queryKey: ['purchase-requests'], queryFn: () => api<PurchaseRequestRow[]>('/purchase-requests'), refetchInterval: 30_000 });
  const [viewing, setViewing] = useState<string | null>(null);
  const pg = usePagination(q.data ?? []);
  const activeCount = (q.data ?? []).filter((x) => (x.status === 'OPEN' || x.status === 'ORDERED') && x.kind !== 'CONSOLIDATED').length;
  const ordered = useMutation({
    mutationFn: (id: string) => api(`/purchase-requests/${id}/ordered`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['purchase-requests'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title={t('navPurchase')}
        actions={activeCount >= 2 && (
          <Button variant="glass" loading={merge.isPending} onClick={() => { if (window.confirm(t('confirmMerge'))) merge.mutate(); }}>
            <Layers className="size-4" /> {t('mergeAll')} ({activeCount})
          </Button>
        )}
      />
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
                  {p.kind === 'CONSOLIDATED' ? (
                    <div className="space-y-0.5 text-sm">
                      <p className="flex items-center gap-1.5 text-plum"><Layers className="size-3.5" aria-hidden /> {t('consolidatedLabel')}</p>
                      {!!p.mergedFrom?.length && (
                        <p className="text-xs text-muted">{t('mergedFromLabel')} {p.mergedFrom.map((m) => `#${m.number}`).join('، ')}</p>
                      )}
                    </div>
                  ) : p.request ? (
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
              <div className="mb-2 flex flex-wrap justify-end gap-2">
                <Button variant="glass" size="sm" onClick={() => setViewing(p.id)}><FileText className="size-3.5" /> {t('viewDoc')}</Button>
              </div>
              {user?.role === 'ADMIN' && (
                <div className="mb-2 flex justify-end">
                  <Button variant="danger" size="sm" loading={del.isPending && del.variables === p.id} onClick={() => { if (window.confirm(t('confirmDelPR'))) del.mutate(p.id); }}>
                    <Trash2 className="size-3.5" /> {t('delPR')}
                  </Button>
                </div>
              )}
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
      {viewing && q.data?.find((x) => x.id === viewing) && (
        <PurchaseDocumentDialog pr={q.data.find((x) => x.id === viewing)!} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

/* ------------------- وثيقة طلب الشراء (تُطبع كمستند واحد) ------------------- */
function PurchaseDocumentDialog({ pr, onClose }: { pr: PurchaseRequestRow; onClose: () => void }) {
  const { t, fmt, dir } = useI18n();
  const merged = pr.kind === 'CONSOLIDATED';
  const total = pr.lines.reduce((s, l) => s + l.quantity, 0);

  const print = () => {
    const root = document.documentElement;
    root.classList.add('printing-invoice');
    window.addEventListener('afterprint', () => root.classList.remove('printing-invoice'), { once: true });
    window.print();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} xl className="print-dialog" title={`${merged ? t('prDocTitleMerged') : t('prDocTitle')} · #${pr.number}`}>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={print}><Printer className="size-4" /> {t('print')}</Button>
      </div>

      <article dir={dir} className="print-area mx-auto w-full max-w-[900px] rounded-lg bg-white p-8 text-[#14171c] shadow-xl sm:p-10">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#14171c] pb-5">
          <div>
            <p className="text-sm font-semibold text-[#4b5563]">{t('appName')}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">{merged ? t('prDocTitleMerged') : t('prDocTitle')}</h2>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[#6b7280]">#</dt><dd className="font-bold" dir="ltr">{pr.number}</dd>
            <dt className="text-[#6b7280]">{t('date')}</dt><dd className="font-semibold">{fmt.date(pr.createdAt)}</dd>
            <dt className="text-[#6b7280]">{t('status')}</dt><dd className="font-semibold">{t(`pr_${pr.status}`)}</dd>
          </dl>
        </header>

        {!merged && pr.request && (
          <section className="grid gap-3 border-b border-[#d7dae0] py-4 text-sm sm:grid-cols-2">
            <p><span className="text-[#6b7280]">{t('srcRequest')}: </span><b>{pr.request.number}</b></p>
            <p><span className="text-[#6b7280]">{t('branch')}: </span><b>{pr.request.branch.name.trim()}</b></p>
            <p><span className="text-[#6b7280]">{t('department')}: </span><b>{pr.request.department.name.trim()}</b></p>
          </section>
        )}

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#eef0f3] text-[#374151]">
              {['#', t('item'), t('code'), t('unitLabel'), t('totalQtyLabel')].map((h) => (
                <th key={h} className="border border-[#d7dae0] px-2.5 py-2 text-start text-xs font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((l, i) => (
              <tr key={l.id} className="[&>td]:border [&>td]:border-[#d7dae0] [&>td]:px-2.5 [&>td]:py-2">
                <td className="tabular-nums text-[#6b7280]">{fmt.num(i + 1)}</td>
                <td className="font-medium">{l.item.name.trim()}</td>
                <td dir="ltr" className="text-start text-[#4b5563]">{l.item.sku}</td>
                <td className="text-[#4b5563]">{l.item.unit}</td>
                <td className="font-semibold tabular-nums">{fmt.num(l.quantity)}</td>
              </tr>
            ))}
            <tr className="bg-[#f8f9fb] font-bold [&>td]:border [&>td]:border-[#d7dae0] [&>td]:px-2.5 [&>td]:py-2">
              <td colSpan={4}>{t('totalQtyLabel')}</td><td className="tabular-nums">{fmt.num(total)}</td>
            </tr>
          </tbody>
        </table>

        {merged && !!pr.mergedFrom?.length && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold">{t('mergeBreakdown')}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#eef0f3] text-[#374151]">
                  {[t('srcPR'), t('srcRequest'), t('branch'), t('department'), t('section'), t('item')].map((h) => (
                    <th key={h} className="border border-[#d7dae0] px-2.5 py-2 text-start text-xs font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pr.mergedFrom.map((s) => (
                  <tr key={s.number} className="align-top [&>td]:border [&>td]:border-[#d7dae0] [&>td]:px-2.5 [&>td]:py-2">
                    <td className="font-semibold tabular-nums">#{s.number}</td>
                    <td className="tabular-nums">{s.request ? s.request.number : t('autoReorder')}</td>
                    <td>{s.request?.branch.name.trim() ?? '—'}</td>
                    <td>{s.request?.department.name.trim() ?? '—'}</td>
                    <td>{s.request?.section?.name.trim() ?? '—'}</td>
                    <td>{s.lines.map((l) => `${l.item.name.trim()} × ${fmt.num(l.quantity)}`).join('، ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-[#4b5563]">
          {[t('prPrepared'), t('prApprover')].map((r) => (
            <div key={r}><div className="h-12 border-b border-[#14171c]" /><p className="mt-1.5">{r} — {t('signatureLabel')}</p></div>
          ))}
        </footer>
        <p className="mt-6 text-center text-[11px] text-[#9ca3af]">{t('generatedBy')}</p>
      </article>
    </Dialog>
  );
}
