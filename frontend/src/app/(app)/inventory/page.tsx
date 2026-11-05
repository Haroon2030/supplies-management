'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { StockRow } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Category { id: string; name: string }

export default function InventoryPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['inventory'], queryFn: () => api<StockRow[]>('/inventory') });
  const [cat, setCat] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<StockRow | 'new' | null>(null);

  const categories = useMemo(() => [...new Set((q.data ?? []).map((r) => r.category))], [q.data]);
  const rows = useMemo(() => {
    const n = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => (!cat || r.category === cat) && (!lowOnly || r.low) && (!n || `${r.name} ${r.sku}`.toLowerCase().includes(n)));
  }, [q.data, cat, lowOnly, search]);
  const pg = usePagination(rows, [cat, lowOnly, search]);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  return (
    <>
      <PageHeader
        title={t('navInventory')}
        subtitle={`${t('stockValue')}: ${fmt.money(totalValue)}`}
        actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> {t('addNewItem')}</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="field !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('category')}>
          <option value="">{t('category')}: {t('all')}</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-inset ring-white/12">
          <input type="checkbox" className="accent-[#0a84ff]" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> {t('lowOnly')}
        </label>
        <input className="field ms-auto !w-56" type="search" placeholder={t('search')} aria-label={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState title={t('none')} /> : (
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>{t('item')}</th><th className={th}>{t('category')}</th><th className={th}>{t('onHand')}</th>
                <th className={th}>{t('minStock')}</th><th className={th}>{t('value')}</th><th className={th} />
              </tr>
            </thead>
            <tbody>
              {pg.slice.map((r) => {
                const expanded = open === r.id;
                const pct = Math.min(100, r.minStock ? (r.onHand / (r.minStock * 3)) * 100 : 100);
                return (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer hover:bg-white/5" onClick={() => setOpen(expanded ? null : r.id)}>
                      <td className={td}>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted" dir="ltr">{r.sku} · {r.unit}</p>
                      </td>
                      <td className={cn(td, 'text-muted')}>{r.category}</td>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <span className={cn('w-12 font-semibold tabular-nums', r.low && 'text-bad')}>{fmt.num(r.onHand)}</span>
                          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
                            <span className={cn('block h-full rounded-full', r.low ? 'bg-bad' : 'bg-ok')} style={{ width: `${pct}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className={cn(td, 'tabular-nums text-muted')}>{fmt.num(r.minStock)}</td>
                      <td className={cn(td, 'tabular-nums')}>{fmt.money(r.value)}</td>
                      <td className={td}>
                        <button aria-expanded={expanded} aria-label={t('batchesFifo')} className="rounded-lg p-1 text-muted hover:bg-white/10">
                          <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-black/20 px-5 py-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{t('batchesFifo')}</p>
                            <Button variant="glass" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>{t('editItem')}</Button>
                          </div>
                          {r.batches.length === 0 ? <p className="text-sm text-muted">{t('none')}</p> : (
                            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {r.batches.map((b, i) => (
                                <li key={b.id} className={cn('rounded-xl p-3 ring-1 ring-inset', i === 0 ? 'bg-accent/10 ring-accent/35' : 'bg-white/4 ring-white/10')}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold tabular-nums">{fmt.num(b.qtyRemaining)} <span className="text-xs font-normal text-muted">/ {fmt.num(b.qtyReceived)}</span></span>
                                    {i === 0 && <Badge tone="accent">{t('batchNext')}</Badge>}
                                  </div>
                                  <p className="mt-1 text-xs text-muted">{t('invoice')} <span dir="ltr">{b.invoiceNumber}</span> · {fmt.date(b.receivedAt)}</p>
                                  <p className="text-xs text-muted">{t('unitCost')}: {fmt.money(b.unitCost)}</p>
                                </li>
                              ))}
                            </ol>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>

      {editing && <ItemDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** تعريف صنف جديد أو تعديل صنف قائم. الحد الأدنى هنا هو ما يولّد طلب الشراء التلقائي. */
function ItemDialog({ item, onClose }: { item: StockRow | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const [f, setF] = useState({
    sku: item?.sku ?? '', name: item?.name ?? '', categoryId: item?.categoryId ?? '', unit: item?.unit ?? 'قطعة',
    minStock: item?.minStock ?? 0, reorderQty: item?.reorderQty ?? 0,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: f.name, categoryId: f.categoryId, unit: f.unit, minStock: Number(f.minStock), reorderQty: Number(f.reorderQty) };
      return item ? api(`/items/${item.id}`, { method: 'PATCH', json: body }) : api('/items', { method: 'POST', json: { ...body, sku: f.sku } });
    },
    onSuccess: () => {
      toast.success(t('itemSaved'));
      // الحد الأدنى قد يولّد طلب شراء فوراً، فنحدّث الشاشات المرتبطة
      for (const k of ['inventory', 'items', 'purchase-requests', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const int = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={item ? t('editItem') : t('addNewItem')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={t('itemName')}><input className="field" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('sku')}><input className="field" dir="ltr" required minLength={2} disabled={!!item} value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} /></Field>
          <Field label={t('category')}>
            <select className="field" required value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">—</option>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('unit')}><input className="field" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <span />
          <Field label={t('minStock')} hint={t('minStockHint')}>
            <input className="field tabular-nums" type="number" min={0} step={1} value={f.minStock} onChange={(e) => setF({ ...f, minStock: int(e.target.value) })} />
          </Field>
          <Field label={t('reorderQty')} hint={t('reorderQtyHint')}>
            <input className="field tabular-nums" type="number" min={0} step={1} value={f.reorderQty} onChange={(e) => setF({ ...f, reorderQty: int(e.target.value) })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
