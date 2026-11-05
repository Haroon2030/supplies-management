'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CornerUpLeft, PackageCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequestForm } from '@/components/request-form';
import { Badge, Button, Card, CardHeader, Dialog, ErrorState, Field, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { RequestDetail } from '@/lib/types';
import { cn, statusTone } from '@/lib/utils';

const ISSUABLE = ['PENDING_WAREHOUSE', 'AWAITING_PURCHASE', 'PARTIALLY_ISSUED'];

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api<RequestDetail>(`/requests/${id}`) });

  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState<null | 'reject' | 'return'>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);

  const refresh = () => {
    for (const k of ['request', 'requests', 'dashboard', 'inventory', 'purchase-requests']) void qc.invalidateQueries({ queryKey: [k] });
  };
  const act = useMutation({
    mutationFn: ({ path, json, method = 'POST' }: { path: string; json?: unknown; method?: string }) =>
      api<RequestDetail>(`/requests/${id}${path}`, { method, json: json ?? (method === 'POST' ? {} : undefined) }),
    onSuccess: (r, v) => {
      refresh();
      setDecision(null); setNote(''); setEditing(false);
      if (v.path === '/issue') {
        r.purchaseRequests.some((p) => p.status !== 'RECEIVED')
          ? toast.warning(t('issuedPartial'))
          : toast.success(t('issuedOk'));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  if (!user) return null;

  const isOwner = r.requester.id === user.id;
  // المعتمد لا يعتمد طلبه بنفسه، أما السوبر أدمن فصلاحيته كاملة
  const canDecide = r.status === 'PENDING_MANAGER'
    && (user.role === 'ADMIN' || (!isOwner && (user.role === 'DEPT_MANAGER' || user.role === 'BRANCH_MANAGER')));
  const canIssue = ISSUABLE.includes(r.status) && (user.role === 'WAREHOUSE_KEEPER' || user.role === 'ADMIN');
  const canEdit = isOwner && r.status === 'NEEDS_EDIT';
  const canCancel = isOwner && (r.status === 'PENDING_MANAGER' || r.status === 'NEEDS_EDIT');
  const approvedQty = (l: RequestDetail['lines'][number]) => qtys[l.id] ?? l.quantity;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`${t('requestNo')} ${r.number}`}
        subtitle={`${r.requester.fullName} · ${r.department.name} · ${r.branch.name}${r.section ? ` · ${r.section.name}` : ''} · ${fmt.date(r.createdAt)}`}
        actions={<Badge tone={statusTone[r.status]} className="px-3 py-1 text-sm">{t(`st_${r.status}`)}</Badge>}
      />

      {r.purchaseRequests.length > 0 && (user.role === 'WAREHOUSE_KEEPER' || user.role === 'ADMIN') && (
        <Link href="/purchase-requests" className="mb-4 block rounded-2xl bg-plum/12 px-4 py-3 text-sm ring-1 ring-plum/30 hover:bg-plum/18">
          {t('shortageNote')} {r.purchaseRequests.map((p) => `#${p.number}`).join('، ')}
        </Link>
      )}

      {editing ? (
        <RequestForm
          submitLabel={t('resubmit')}
          busy={act.isPending}
          initial={{ justification: r.justification ?? '', lines: r.lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })) }}
          onSubmit={(v) => act.mutate({ path: '', method: 'PATCH', json: { ...v, justification: v.justification || undefined } })}
        />
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader title={t('item')} hint={canDecide ? t('approvedQtyHint') : undefined} />
            <div className="mt-2">
              <TableWrap>
                <thead>
                  <tr>
                    <th className={th}>{t('item')}</th><th className={th}>{t('requested')}</th>
                    <th className={th}>{t('approved')}</th><th className={th}>{t('issued')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l) => (
                    <tr key={l.id}>
                      <td className={td}>
                        <p className="font-medium">{l.item.name}</p>
                        <p className="text-xs text-muted">{l.item.category.name} · {l.item.unit}</p>
                      </td>
                      <td className={cn(td, 'tabular-nums')}>{fmt.num(l.quantity)}</td>
                      <td className={cn(td, 'tabular-nums')}>
                        {canDecide ? (
                          <input
                            className="field !w-24 tabular-nums" type="number" min={0} max={l.quantity} value={approvedQty(l)}
                            aria-label={`${t('approved')} ${l.item.name}`}
                            onChange={(e) => setQtys((s) => ({ ...s, [l.id]: Math.min(l.quantity, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))}
                          />
                        ) : l.approvedQty ?? '—'}
                      </td>
                      <td className={td}>
                        {l.approvedQty != null ? (
                          <span className={cn('tabular-nums', l.issuedQty >= l.approvedQty ? 'text-ok' : l.issuedQty > 0 ? 'text-plum' : 'text-muted')}>
                            {fmt.num(l.issuedQty)} / {fmt.num(l.approvedQty)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
            {r.justification && <p className="border-t border-line px-5 py-4 text-sm"><span className="text-muted">{t('justification')}: </span>{r.justification}</p>}
          </Card>

          <div className="mb-8 flex flex-wrap gap-2">
            {canDecide && (
              <>
                <Button
                  variant="success" loading={act.isPending}
                  onClick={() => act.mutate({ path: '/approve', json: { lines: r.lines.map((l) => ({ lineId: l.id, approvedQty: approvedQty(l) })) } })}
                ><Check className="size-4" /> {t('approve')}</Button>
                <Button variant="glass" onClick={() => setDecision('return')}><CornerUpLeft className="size-4" /> {t('returnForEdit')}</Button>
                <Button variant="danger" onClick={() => setDecision('reject')}><X className="size-4" /> {t('reject')}</Button>
              </>
            )}
            {canIssue && (
              <Button size="lg" loading={act.isPending} onClick={() => act.mutate({ path: '/issue' })}>
                <PackageCheck className="size-5" /> {t('issueNow')}
              </Button>
            )}
            {canEdit && <Button onClick={() => setEditing(true)}>{t('editAndResend')}</Button>}
            {canCancel && <Button variant="ghost" loading={act.isPending} onClick={() => act.mutate({ path: '/cancel' })}>{t('cancelRequest')}</Button>}
          </div>
        </>
      )}

      <Card>
        <CardHeader title={t('timeline')} />
        <ol className="relative space-y-5 p-5">
          {r.events.map((e) => (
            <li key={e.id} className="relative ps-7">
              <span className={cn('absolute start-0 top-1.5 size-3 rounded-full ring-4 ring-[#1c1c1e]',
                e.action === 'REJECTED' ? 'bg-bad' : e.action === 'ISSUED' || e.action === 'APPROVED' ? 'bg-ok' : e.action === 'RETURNED' ? 'bg-plum' : 'bg-accent')} />
              <p className="text-sm font-medium">{t(`ev_${e.action}`)}</p>
              <p className="text-xs text-muted">{e.actor.fullName} · {fmt.date(e.createdAt)}</p>
              {e.note && <p className="mt-1 rounded-lg bg-white/5 px-3 py-2 text-sm">{e.note}</p>}
            </li>
          ))}
        </ol>
      </Card>

      <Dialog
        open={decision !== null}
        onOpenChange={(o) => !o && setDecision(null)}
        title={decision === 'reject' ? t('reject') : t('returnForEdit')}
        description={t('noteRequired')}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); act.mutate({ path: decision === 'reject' ? '/reject' : '/return', json: { note } }); }}
        >
          <Field label={t('managerNote')}>
            <textarea className="field min-h-28" required minLength={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDecision(null)}>{t('cancel')}</Button>
            <Button type="submit" variant={decision === 'reject' ? 'danger' : 'primary'} loading={act.isPending}>
              {decision === 'reject' ? t('reject') : t('returnForEdit')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
