'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Printer, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { InvoiceDetail, InvoiceRow, Item, PurchaseRequestRow } from '@/lib/types';
import { zatcaTlv } from '@/lib/zatca';

interface Branch { id: string; name: string }
interface Supplier { id: string; name: string }
interface Line { itemId: string; quantity: number; unitCost: number }

const EMPTY: Line = { itemId: '', quantity: 1, unitCost: 0 };
const round2 = (n: number) => Math.round(n * 100) / 100;
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME;
const COMPANY_VAT = process.env.NEXT_PUBLIC_COMPANY_VAT;

export default function InvoicesPage() {
  return <Suspense fallback={<Spinner />}><Inner /></Suspense>;
}

function Inner() {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const prParam = useSearchParams().get('pr');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['invoices'], queryFn: () => api<InvoiceRow[]>('/invoices') });
  const pg = usePagination(q.data ?? []);

  // القدوم من شاشة طلبات الشراء يفتح النموذج مباشرة
  useEffect(() => { if (prParam) setCreating(true); }, [prParam]);

  return (
    <>
      <PageHeader title={t('navInvoices')} actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> {t('newInvoice')}</Button>} />
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title={t('none')} /> : (
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>{t('invoiceNo')}</th><th className={th}>{t('supplier')}</th><th className={th}>{t('branch')}</th>
                <th className={th}>{t('invoiceDate')}</th><th className={th}>{t('lines')}</th>
                <th className={th}>{t('subtotalLabel')}</th><th className={th}>{t('rowTotalVat')}</th><th className={th}>{t('createdBy')}</th>
              </tr>
            </thead>
            <tbody>
              {pg.slice.map((i) => (
                <tr
                  key={i.id}
                  className="cursor-pointer hover:bg-white/5 focus-visible:bg-white/5"
                  tabIndex={0}
                  onClick={() => setViewing(i.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setViewing(i.id); }}
                >
                  <td className={`${td} font-semibold`} dir="ltr">{i.number}</td>
                  <td className={td}>{i.supplier.name}</td>
                  <td className={`${td} text-muted`}>{i.branch.name}</td>
                  <td className={`${td} text-muted`}>{fmt.date(i.invoiceDate)}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{fmt.num(i._count.lines)}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums text-muted`}>{fmt.money(Number(i.subtotal))}</td>
                  <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>{fmt.money(Number(i.total))}</td>
                  <td className={`${td} text-muted`}>{i.createdBy.fullName}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {viewing && <InvoiceDocumentDialog id={viewing} onClose={() => setViewing(null)} />}
      {creating && <InvoiceDialog prId={prParam} onClose={() => { setCreating(false); if (prParam) router.replace('/invoices'); }} />}
    </>
  );
}

/* ------------------------------ إدخال فاتورة ------------------------------ */
function InvoiceDialog({ prId, onClose }: { prId: string | null; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ['items'], queryFn: () => api<Item[]>('/items') });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('/suppliers') });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const prs = useQuery({ queryKey: ['purchase-requests'], queryFn: () => api<PurchaseRequestRow[]>('/purchase-requests') });

  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ number: '', supplierId: '', branchId: user?.branch?.id ?? '', invoiceDate: today, purchaseRequestId: prId ?? '', notes: '' });
  const [vatRate, setVatRate] = useState(15);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }]);
  const itemById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);

  // تعبئة الأسطر من طلب الشراء المختار (مرة عند الاختيار)
  const openPrs = useMemo(() => (prs.data ?? []).filter((p) => p.status === 'OPEN' || p.status === 'ORDERED'), [prs.data]);
  const [filledFor, setFilledFor] = useState('');
  useEffect(() => {
    if (!f.purchaseRequestId || filledFor === f.purchaseRequestId) return;
    const pr = prs.data?.find((p) => p.id === f.purchaseRequestId);
    const all = items.data;
    if (!pr || !all) return;
    setLines([...pr.lines.map((l) => ({ itemId: all.find((i) => i.sku === l.item.sku)?.id ?? '', quantity: l.quantity, unitCost: 0 })), { ...EMPTY }]);
    setFilledFor(f.purchaseRequestId);
  }, [f.purchaseRequestId, prs.data, items.data, filledFor]);

  const factor = 1 + vatRate / 100;
  const rowTotal = (l: Line) => round2(l.quantity * l.unitCost * factor);
  const filled = lines.filter((l) => l.itemId);
  const subtotal = round2(filled.reduce((s, l) => s + l.quantity * l.unitCost, 0));
  const total = round2(subtotal * factor);
  const vat = round2(total - subtotal);
  const valid = !!(f.number && f.supplierId && f.branchId && filled.length > 0 && filled.every((l) => l.quantity >= 1 && l.unitCost > 0));

  const patch = (i: number, p: Partial<Line>) =>
    setLines((ls) => {
      const next = ls.map((l, idx) => (idx === i ? { ...l, ...p } : l));
      // اختيار صنف في آخر سطر يفتح سطراً جديداً تلقائياً لتسريع الإدخال
      return p.itemId && i === ls.length - 1 ? [...next, { ...EMPTY }] : next;
    });
  // حذف الصف: إن كان الوحيد يُفرَّغ بدل أن يختفي النموذج
  const removeRow = (i: number) => setLines((ls) => (ls.length === 1 ? [{ ...EMPTY }] : ls.filter((_, x) => x !== i)));

  const save = useMutation({
    mutationFn: () => api('/invoices', {
      method: 'POST',
      json: { ...f, vatRate, purchaseRequestId: f.purchaseRequestId || undefined, notes: f.notes || undefined, lines: filled },
    }),
    onSuccess: () => {
      toast.success(t('invoiceSaved'));
      for (const k of ['invoices', 'inventory', 'purchase-requests', 'dashboard', 'requests']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols = 'grid-cols-[minmax(0,2.6fr)_8rem_9.5rem_7rem_10.5rem_6.5rem]';
  const big = '!min-h-[52px] !text-[15px]';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('newInvoice')} xl>
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        {/* الترويسة: المورد والتاريخ ورقم الفاتورة */}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('supplier')}>
            <select className={`field ${big}`} required value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
              <option value="">—</option>{suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t('invoiceDate')}><input className={`field ${big}`} type="date" required max={today} value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} /></Field>
          <Field label={t('invoiceNo')}><input className={`field ${big}`} dir="ltr" required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
        </div>

        {/* الأسطر */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px] space-y-2.5">
            <div className={`grid ${cols} gap-3 px-1 text-sm font-medium text-muted`}>
              <span>{t('item')}</span><span>{t('code')}</span><span>{t('unitCostExVat')}</span><span>{t('qtyShort')}</span><span>{t('rowTotalVat')}</span><span />
            </div>
            {lines.map((l, i) => {
              const item = itemById.get(l.itemId);
              return (
                <div key={i} className={`grid ${cols} items-center gap-3 rounded-2xl p-1 transition-colors hover:bg-white/[0.03]`}>
                  <select className={`field ${big}`} aria-label={t('item')} value={l.itemId} onChange={(e) => patch(i, { itemId: e.target.value })}>
                    <option value="">{t('chooseItem')}</option>
                    {items.data?.filter((it) => it.active).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                  <input className={`field ${big} text-muted`} dir="ltr" readOnly tabIndex={-1} aria-label={t('code')} value={item?.sku ?? ''} />
                  <input className={`field ${big} tabular-nums`} type="number" min={0.01} step={0.01} aria-label={t('unitCostExVat')} value={l.unitCost || ''} onChange={(e) => patch(i, { unitCost: Number(e.target.value) })} />
                  <input className={`field ${big} tabular-nums`} type="number" min={1} step={1} aria-label={t('qtyShort')} value={l.quantity} onChange={(e) => patch(i, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  <output className={`field ${big} flex items-center whitespace-nowrap font-semibold tabular-nums`} aria-label={t('rowTotalVat')}>{l.itemId ? fmt.money2(rowTotal(l)) : '—'}</output>
                  <button
                    type="button" onClick={() => removeRow(i)} aria-label={t('deleteRow')} title={t('deleteRow')}
                    className="flex h-[52px] items-center justify-center gap-1.5 rounded-xl bg-bad/10 text-sm font-medium text-bad ring-1 ring-inset ring-bad/25 hover:bg-bad/20"
                  >
                    <Trash2 className="size-4" /> {t('deleteRow').split(' ')[0]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <Button type="button" variant="glass" onClick={() => setLines((ls) => [...ls, { ...EMPTY }])}><Plus className="size-4" /> {t('addLine')}</Button>

        {/* خيارات إضافية */}
        <details className="rounded-2xl bg-white/[0.04] px-5 py-3.5 ring-1 ring-inset ring-white/8">
          <summary className="cursor-pointer text-sm font-medium">{t('moreOptions')}</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label={t('branch')}>
              <select className={`field ${big}`} required value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
                <option value="">—</option>{branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label={t('linkedPR')}>
              <select className={`field ${big}`} value={f.purchaseRequestId} onChange={(e) => setF({ ...f, purchaseRequestId: e.target.value })}>
                <option value="">—</option>
                {openPrs.map((p) => <option key={p.id} value={p.id}>#{p.number} · {p.request ? `${t('forRequest')} ${p.request.number}` : t('autoReorder')}</option>)}
              </select>
            </Field>
            <Field label={t('vatRateLabel')}>
              <input className={`field ${big} tabular-nums`} type="number" min={0} max={100} step={0.5} value={vatRate} onChange={(e) => setVatRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </Field>
          </div>
        </details>

        {/* الإجماليات */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
          <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-1.5 text-[15px]">
            <dt className="text-muted">{t('subtotalLabel')}</dt><dd className="tabular-nums">{fmt.money2(subtotal)}</dd>
            <dt className="text-muted">{t('vatLabel')} ({fmt.num(vatRate)}%)</dt><dd className="tabular-nums">{fmt.money2(vat)}</dd>
            <dt className="font-semibold">{t('rowTotalVat')}</dt><dd className="text-2xl font-bold tabular-nums">{fmt.money2(total)}</dd>
          </dl>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit" size="lg" disabled={!valid} loading={save.isPending}>{t('save')}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------- الفاتورة الرسمية مع رمز QR ---------------------- */
function InvoiceDocumentDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, fmt, dir } = useI18n();
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => api<InvoiceDetail>(`/invoices/${id}`) });
  const inv = q.data;
  const [qr, setQr] = useState('');

  const factor = inv ? 1 + inv.vatRate / 100 : 1;
  const subtotal = inv ? Number(inv.subtotal) : 0;
  const total = inv ? Number(inv.total) : 0;
  const vat = round2(total - subtotal);

  // رمز QR بصيغة الفاتورة الإلكترونية السعودية (TLV → Base64)
  useEffect(() => {
    if (!inv) return;
    const payload = zatcaTlv({
      seller: inv.supplier.name, vatNumber: inv.supplier.vatNumber ?? '',
      timestamp: new Date(inv.invoiceDate).toISOString(), total, vat,
    });
    void QRCode.toDataURL(payload, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [inv, total, vat]);

  const print = () => {
    const root = document.documentElement;
    root.classList.add('printing-invoice');
    window.addEventListener('afterprint', () => root.classList.remove('printing-invoice'), { once: true });
    window.print();
  };

  return (
    <Dialog
      open onOpenChange={(o) => !o && onClose()} xl className="print-dialog"
      title={inv ? `${t('invoiceTitle')} · ${inv.number}` : t('invoiceTitle')}
    >
      {q.isLoading ? <Spinner /> : q.isError || !inv ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className="no-print mb-4 flex justify-end">
            <Button onClick={print}><Printer className="size-4" /> {t('print')}</Button>
          </div>

          {/* ورقة الفاتورة: خلفية بيضاء بنمط مستند رسمي */}
          <article dir={dir} className="print-area mx-auto w-full max-w-[900px] rounded-lg bg-white p-8 text-[#14171c] shadow-xl sm:p-10">
            <header className="flex items-start justify-between gap-6 border-b-2 border-[#14171c] pb-5">
              <div>
                <p className="text-sm font-semibold text-[#4b5563]">{COMPANY_NAME ?? t('appName')}</p>
                {COMPANY_VAT && <p className="text-xs text-[#6b7280]">{t('vatNo')}: <bdi dir="ltr">{COMPANY_VAT}</bdi></p>}
                <h2 className="mt-3 text-3xl font-bold tracking-tight">{t('invoiceTitle')}</h2>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="text-[#6b7280]">{t('invoiceNo')}</dt><dd className="font-bold" dir="ltr">{inv.number}</dd>
                <dt className="text-[#6b7280]">{t('invoiceDate')}</dt><dd className="font-semibold">{fmt.date(inv.invoiceDate)}</dd>
                {inv.purchaseRequest && (<><dt className="text-[#6b7280]">{t('linkedPurchase')}</dt><dd className="font-semibold">#{inv.purchaseRequest.number}</dd></>)}
              </dl>
            </header>

            <section className="grid gap-4 border-b border-[#d7dae0] py-5 text-sm sm:grid-cols-2">
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[#6b7280]">{t('sellerLabel')}</h3>
                <p className="text-base font-bold">{inv.supplier.name}</p>
                <p className="text-[#4b5563]">{t('vatNo')}: <bdi dir="ltr">{inv.supplier.vatNumber ?? t('notRegistered')}</bdi></p>
                {inv.supplier.phone && <p className="text-[#4b5563]">{t('phoneLabel')}: <bdi dir="ltr">{inv.supplier.phone}</bdi></p>}
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[#6b7280]">{t('buyerLabel')}</h3>
                <p className="text-base font-bold">{inv.branch.name}</p>
                <p className="text-[#4b5563]">{t('createdBy')}: {inv.createdBy.fullName}</p>
              </div>
            </section>

            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#eef0f3] text-[#374151]">
                  {['#', t('item'), t('code'), t('unitLabel'), t('unitCostExVat'), t('qtyShort'), t('lineSubtotal'), t('rowTotalVat')].map((h) => (
                    <th key={h} className="border border-[#d7dae0] px-2.5 py-2 text-start text-xs font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => {
                  const sub = round2(l.quantity * Number(l.unitCost));
                  return (
                    <tr key={l.id} className="[&>td]:border [&>td]:border-[#d7dae0] [&>td]:px-2.5 [&>td]:py-2">
                      <td className="tabular-nums text-[#6b7280]">{fmt.num(i + 1)}</td>
                      <td className="font-medium">{l.item.name}</td>
                      <td dir="ltr" className="text-start text-[#4b5563]">{l.item.sku}</td>
                      <td className="text-[#4b5563]">{l.item.unit}</td>
                      <td className="whitespace-nowrap tabular-nums">{fmt.money2(Number(l.unitCost))}</td>
                      <td className="tabular-nums">{fmt.num(l.quantity)}</td>
                      <td className="whitespace-nowrap tabular-nums">{fmt.money2(sub)}</td>
                      <td className="whitespace-nowrap font-semibold tabular-nums">{fmt.money2(round2(sub * factor))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <section className="mt-6 flex flex-wrap items-end justify-between gap-6">
              <div className="text-center">
                {qr ? <img src={qr} alt="QR" width={132} height={132} className="mx-auto" /> : <div className="size-[132px] bg-[#eef0f3]" />}
                <p className="mt-1 text-[11px] text-[#6b7280]">{t('scanQr')}</p>
              </div>
              <dl className="grid min-w-[280px] grid-cols-[1fr_auto] gap-x-8 gap-y-1.5 text-sm">
                <dt className="text-[#4b5563]">{t('subtotalLabel')}</dt><dd className="tabular-nums">{fmt.money2(subtotal)}</dd>
                <dt className="text-[#4b5563]">{t('vatLabel')} ({fmt.num(inv.vatRate)}%)</dt><dd className="tabular-nums">{fmt.money2(vat)}</dd>
                <dt className="border-t-2 border-[#14171c] pt-2 text-base font-bold">{t('rowTotalVat')}</dt>
                <dd className="border-t-2 border-[#14171c] pt-2 text-xl font-bold tabular-nums">{fmt.money2(total)}</dd>
              </dl>
            </section>

            {inv.notes && <p className="mt-5 rounded border border-[#d7dae0] bg-[#f8f9fb] px-3 py-2 text-sm"><b>{t('notesLabel')}: </b>{inv.notes}</p>}

            <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-[#4b5563]">
              {[t('storekeeper'), t('financeMgr')].map((r) => (
                <div key={r}><div className="h-12 border-b border-[#14171c]" /><p className="mt-1.5">{r} — {t('signatureLabel')}</p></div>
              ))}
            </footer>
            <p className="mt-6 text-center text-[11px] text-[#9ca3af]">{t('generatedBy')}</p>
          </article>
        </>
      )}
    </Dialog>
  );
}
