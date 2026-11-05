'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Item, PurchaseRequestRow } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SupplyRow {
  id: string; number: number; receivedAt: string; source: string | null;
  branch: { name: string }; createdBy: { fullName: string }; _count: { lines: number };
}
interface SupplyDetail extends Omit<SupplyRow, '_count'> {
  notes: string | null; purchaseRequest: { number: number } | null;
  lines: { id: string; quantity: number; unitCost: string; item: { name: string; sku: string; unit: string } }[];
}
interface Branch { id: string; name: string }
interface Line { itemId: string; quantity: number; unitCost: string }

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: Line = { itemId: '', quantity: 1, unitCost: '' };

export default function SuppliesPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['supplies'], queryFn: () => api<SupplyRow[]>('/supplies') });
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const pg = usePagination(q.data ?? []);

  return (
    <>
      <PageHeader
        title={t('navSupply')} subtitle={t('supplyHint')}
        actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> {t('newSupply')}</Button>}
      />
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title={t('noSupplies')} /> : (
          <TableWrap>
            <thead><tr>
              <th className={th}>{t('supplyNo')}</th><th className={th}>{t('supplyDate')}</th><th className={th}>{t('branch')}</th>
              <th className={th}>{t('supplySource')}</th><th className={th}>{t('supplyItems')}</th><th className={th}>{t('supplyBy')}</th>
            </tr></thead>
            <tbody>
              {pg.slice.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-white/5" onClick={() => setViewing(s.id)}>
                  <td className={cn(td, 'font-semibold tabular-nums')} dir="ltr">T-{s.number}</td>
                  <td className={cn(td, 'tabular-nums')}>{fmt.date(s.receivedAt)}</td>
                  <td className={td}>{s.branch.name.trim()}</td>
                  <td className={cn(td, 'text-muted')}>{s.source || '—'}</td>
                  <td className={cn(td, 'tabular-nums')}>{fmt.num(s._count.lines)}</td>
                  <td className={cn(td, 'text-muted')}>{s.createdBy.fullName}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {creating && <SupplyDialog onClose={() => setCreating(false)} />}
      {viewing && <SupplyViewDialog id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/* --------------------------------- إدخال سند --------------------------------- */
function SupplyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ['items'], queryFn: () => api<Item[]>('/items') });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const prs = useQuery({ queryKey: ['purchase-requests'], queryFn: () => api<PurchaseRequestRow[]>('/purchase-requests') });

  const [date, setDate] = useState(today());
  const [branchId, setBranchId] = useState(user?.branch?.id ?? '');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [prId, setPrId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }]);

  const active = (items.data ?? []).filter((i) => i.active);
  const openPrs = (prs.data ?? []).filter((p) => p.status === 'OPEN' || p.status === 'ORDERED');
  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const chosen = new Set(lines.map((l) => l.itemId));
  const valid = !!branchId && lines.length > 0 && lines.every((l) => l.itemId && l.quantity >= 1);

  // اختيار طلب شراء يملأ الأصناف والكميات المطلوبة منه
  const pickPr = (id: string) => {
    setPrId(id);
    const pr = openPrs.find((p) => p.id === id);
    if (!pr) return;
    const next = pr.lines
      .map((l) => ({ itemId: active.find((i) => i.sku === l.item.sku)?.id ?? '', quantity: l.quantity, unitCost: '' }))
      .filter((l) => l.itemId);
    if (next.length) setLines(next);
  };

  const save = useMutation({
    mutationFn: () => api('/supplies', {
      method: 'POST',
      json: {
        branchId, receivedAt: date, source: source.trim() || undefined, notes: notes.trim() || undefined,
        purchaseRequestId: prId || undefined,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, ...(l.unitCost !== '' ? { unitCost: Number(l.unitCost) } : {}) })),
      },
    }),
    onSuccess: () => {
      toast.success(t('supplySaved'));
      for (const k of ['supplies', 'inventory', 'purchase-requests', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('newSupply')} description={t('supplyHint')} xl>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('supplyDate')}><input className="field" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t('branch')}>
            <select className="field" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('chooseBranch')}</option>
              {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name.trim()}</option>)}
            </select>
          </Field>
          <Field label={t('supplySource')}>
            <input className="field" list="supply-sources" placeholder={t('supplySourcePh')} value={source} onChange={(e) => setSource(e.target.value)} />
            <datalist id="supply-sources">
              {['تبرع', 'رصيد افتتاحي', 'تحويل من فرع', 'عهدة مرتجعة', 'جرد وتسوية'].map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          {openPrs.length > 0 && (
            <Field label={t('supplyLinkPR')}>
              <select className="field" value={prId} onChange={(e) => pickPr(e.target.value)}>
                <option value="">—</option>
                {openPrs.map((p) => <option key={p.id} value={p.id}>#{p.number} · {p.lines.map((l) => l.item.name).join('، ').slice(0, 40)}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div>
          <div className="mb-2 hidden grid-cols-[2rem_1fr_7rem_9rem_2.75rem] gap-3 px-1 text-xs font-medium text-muted sm:grid">
            <span>#</span><span>{t('item')}</span><span>{t('qty')}</span><span>{t('supplyCostOpt')}</span><span />
          </div>
          <ul className="space-y-2.5">
            {lines.map((l, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr_2.75rem] items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-inset ring-white/8 sm:grid-cols-[2rem_1fr_7rem_9rem_2.75rem]">
                <span className="grid size-7 place-items-center rounded-full bg-accent/18 text-xs font-bold tabular-nums text-accent-soft">{i + 1}</span>
                <select className="field" required value={l.itemId} onChange={(e) => patch(i, { itemId: e.target.value })} aria-label={t('item')}>
                  <option value="">{t('chooseItem')}</option>
                  {active.map((it) => <option key={it.id} value={it.id} disabled={chosen.has(it.id) && it.id !== l.itemId}>{it.name.trim()} · {it.sku}</option>)}
                </select>
                <Button type="button" variant="ghost" size="md" className="px-0 sm:order-last" disabled={lines.length === 1} aria-label={t('removeRow')} onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>
                  <Trash2 className="size-4" />
                </Button>
                <input
                  className="field tabular-nums col-span-3 sm:col-span-1" type="number" min={1} step={1} required value={l.quantity} aria-label={t('qty')}
                  onChange={(e) => patch(i, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                />
                <input
                  className="field tabular-nums col-span-3 sm:col-span-1" type="number" min={0} step="0.01" placeholder="0.00" value={l.unitCost} aria-label={t('supplyCostOpt')}
                  onChange={(e) => patch(i, { unitCost: e.target.value })}
                />
              </li>
            ))}
          </ul>
          <Button type="button" variant="glass" size="sm" className="mt-3" onClick={() => setLines((ls) => [...ls, { ...EMPTY }])}>
            <Plus className="size-4" /> {t('addItem')}
          </Button>
        </div>

        <Field label={t('supplyNotes')}>
          <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" size="lg" disabled={!valid} loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* --------------------------------- عرض سند --------------------------------- */
function SupplyViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['supply', id], queryFn: () => api<SupplyDetail>(`/supplies/${id}`) });
  const del = useMutation({
    mutationFn: () => api(`/supplies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deletedOk'));
      for (const k of ['supplies', 'inventory', 'purchase-requests', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = q.data;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={s ? `${t('supplyTitle')} · T-${s.number}` : t('supplyTitle')} xl>
      {q.isLoading ? <Spinner /> : q.isError || !s ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted">{t('supplyDate')}</dt><dd className="font-medium">{fmt.date(s.receivedAt)}</dd></div>
            <div><dt className="text-xs text-muted">{t('branch')}</dt><dd className="font-medium">{s.branch.name.trim()}</dd></div>
            <div><dt className="text-xs text-muted">{t('supplySource')}</dt><dd className="font-medium">{s.source || '—'}</dd></div>
            <div><dt className="text-xs text-muted">{t('supplyBy')}</dt><dd className="font-medium">{s.createdBy.fullName}</dd></div>
          </dl>
          <TableWrap>
            <thead><tr><th className={th}>{t('item')}</th><th className={th}>{t('qty')}</th><th className={th}>{t('supplyCostOpt')}</th></tr></thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id}>
                  <td className={td}><p className="font-medium">{l.item.name.trim()}</p><p className="text-xs text-muted" dir="ltr">{l.item.sku} · {l.item.unit}</p></td>
                  <td className={cn(td, 'tabular-nums')}>{fmt.num(l.quantity)}</td>
                  <td className={cn(td, 'tabular-nums')}>{Number(l.unitCost) ? fmt.money(Number(l.unitCost)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {s.notes && <p className="rounded-xl bg-white/5 px-4 py-3 text-sm">{s.notes}</p>}
          {s.purchaseRequest && <p className="text-xs text-muted">{t('supplyLinkPR')}: #{s.purchaseRequest.number}</p>}
          {user?.role === 'ADMIN' && (
            <div className="flex justify-end">
              <Button variant="danger" loading={del.isPending} onClick={() => { if (window.confirm(t('confirmDelSupply'))) del.mutate(); }}>
                <Trash2 className="size-4" /> {t('delSupply')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
