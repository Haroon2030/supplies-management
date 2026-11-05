'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser, PenLine, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Badge, Button, Dialog, ErrorState, Field, Spinner } from './ui';

export interface CustodyDetail {
  id: string; number: number; status: 'PENDING' | 'SIGNED'; createdAt: string; signedAt: string | null;
  signerName: string | null; signerIdNo: string | null; signature: string | null;
  custodian: { id: string; fullName: string; username: string | null };
  issuedBy: { fullName: string };
  approvedBy: string | null;
  total: number;
  request: { id: string; number: number; department: { name: string }; branch: { name: string }; section: { name: string } | null };
  units: { id: string; serial: string; unitCost: string; item: { name: string; sku: string; unit: string } }[];
}

/* ------------------------------ لوحة التوقيع ------------------------------ */
function SignaturePad({ onChange, clearLabel }: { onChange: (png: string | null) => void; clearLabel: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current!.getContext('2d')!;
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(dirty.current ? ref.current!.toDataURL('image/png') : null);
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref} width={480} height={160} aria-label="signature"
        className="h-32 w-full touch-none cursor-crosshair rounded-xl bg-white ring-1 ring-white/20"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      />
      <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={clear}><Eraser className="size-3.5" /> {clearLabel}</Button>
    </div>
  );
}

/* --------------------------- سند استلام العهدة --------------------------- */
export function CustodyReceiptDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, fmt, dir } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['custody', id], queryFn: () => api<CustodyDetail>(`/custody/${id}`) });
  const c = q.data;

  const [mode, setMode] = useState<'doc' | 'labels'>('doc');
  const [signerName, setSignerName] = useState('');
  const [signerIdNo, setSignerIdNo] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => { if (c && !signerName) setSignerName(c.custodian.fullName); }, [c, signerName]);
  // ملصقات الأرقام التسلسلية: رمز QR لكل وحدة
  useEffect(() => {
    if (!c) return;
    void Promise.all(c.units.map(async (u) => [u.serial, await QRCode.toDataURL(u.serial, { margin: 0, width: 120 })] as const))
      .then((e) => setQrs(Object.fromEntries(e))).catch(() => setQrs({}));
  }, [c]);

  const canSign = !!c && c.status === 'PENDING' && (user?.role === 'WAREHOUSE_KEEPER' || user?.role === 'ADMIN');

  const sign = useMutation({
    mutationFn: () => api(`/custody/${id}/sign`, {
      method: 'POST',
      json: { signerName: signerName.trim(), signerIdNo: signerIdNo.trim() || undefined, signature: signature ?? undefined },
    }),
    onSuccess: () => {
      toast.success(t('custodySignedOk'));
      for (const k of ['custody', 'request', 'requests']) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const print = (m: 'doc' | 'labels') => {
    flushSync(() => setMode(m));
    const root = document.documentElement;
    root.classList.add('printing-invoice');
    window.addEventListener('afterprint', () => { root.classList.remove('printing-invoice'); setMode('doc'); }, { once: true });
    window.print();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} xl className="print-dialog" title={c ? `${t('custodyTitle')} · C-${c.number}` : t('custodyTitle')}>
      {q.isLoading ? <Spinner /> : q.isError || !c ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <div className="no-print flex flex-wrap items-center justify-between gap-2">
            <Badge tone={c.status === 'SIGNED' ? 'ok' : 'warn'}>{t(c.status === 'SIGNED' ? 'custodySigned' : 'custodyPending')}</Badge>
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" onClick={() => print('labels')}><QrCode className="size-4" /> {t('custodyPrintLabels')}</Button>
              <Button onClick={() => print('doc')}><Printer className="size-4" /> {t('custodyPrintDoc')}</Button>
            </div>
          </div>

          {/* الخطوة الأخيرة: توقيع المستلم */}
          {canSign && (
            <section className="no-print rounded-2xl bg-white/[0.05] p-5 ring-1 ring-inset ring-white/10">
              <h3 className="mb-1 flex items-center gap-2 text-base font-semibold"><PenLine className="size-4 text-accent-soft" /> {t('custodySignTitle')}</h3>
              <p className="mb-4 text-sm text-muted">{t('custodySignHint')}</p>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); sign.mutate(); }}>
                <Field label={t('custodySignerName')}><input className="field" required minLength={3} value={signerName} onChange={(e) => setSignerName(e.target.value)} /></Field>
                <Field label={t('custodySignerId')}><input className="field" dir="ltr" value={signerIdNo} onChange={(e) => setSignerIdNo(e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-sm font-medium text-fg/90">{t('custodyDraw')}</p>
                  <SignaturePad onChange={setSignature} clearLabel={t('custodyClear')} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" size="lg" loading={sign.isPending}>{t('custodySignBtn')}</Button>
                </div>
              </form>
            </section>
          )}

          {/* الوثيقة الرسمية */}
          <article dir={dir} className={cn('mx-auto w-full max-w-[900px] rounded-lg bg-white p-8 text-[#14171c] shadow-xl sm:p-10', mode === 'doc' && 'print-area')}>
            <header className="flex items-start justify-between gap-6 border-b-2 border-[#14171c] pb-5">
              <div>
                <p className="text-sm font-semibold text-[#4b5563]">{t('appName')}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">{t('custodyTitle')}</h2>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="text-[#6b7280]">{t('custodyNo')}</dt><dd className="font-bold" dir="ltr">C-{c.number}</dd>
                <dt className="text-[#6b7280]">{t('date')}</dt><dd className="font-semibold">{fmt.date(c.createdAt)}</dd>
                <dt className="text-[#6b7280]">{t('srcRequest')}</dt><dd className="font-semibold">{c.request.number}</dd>
              </dl>
            </header>

            <section className="grid gap-4 border-b border-[#d7dae0] py-5 text-sm sm:grid-cols-2">
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[#6b7280]">{t('custodyCustodian')}</h3>
                <p className="text-base font-bold">{c.custodian.fullName}</p>
                {c.custodian.username && <p className="text-[#4b5563]">{t('username')}: <bdi dir="ltr">{c.custodian.username}</bdi></p>}
                <p className="text-[#4b5563]">{t('branch')}: {c.request.branch.name.trim()}</p>
                <p className="text-[#4b5563]">{t('department')}: {c.request.department.name.trim()}</p>
                {c.request.section && <p className="text-[#4b5563]">{t('section')}: {c.request.section.name.trim()}</p>}
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-[#6b7280]">{t('custodyIssuer')}</h3>
                <p className="text-base font-bold">{c.issuedBy.fullName}</p>
                {c.approvedBy && <p className="text-[#4b5563]">{t('custodyApprover')}: {c.approvedBy}</p>}
              </div>
            </section>

            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#eef0f3] text-[#374151]">
                  {['#', t('item'), t('code'), t('custodySerial'), t('custodyUnitValue')].map((h) => (
                    <th key={h} className="border border-[#d7dae0] px-2.5 py-2 text-start text-xs font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.units.map((u, i) => (
                  <tr key={u.id} className="[&>td]:border [&>td]:border-[#d7dae0] [&>td]:px-2.5 [&>td]:py-2">
                    <td className="tabular-nums text-[#6b7280]">{fmt.num(i + 1)}</td>
                    <td className="font-medium">{u.item.name.trim()}</td>
                    <td dir="ltr" className="text-start text-[#4b5563]">{u.item.sku}</td>
                    <td dir="ltr" className="text-start font-bold tracking-wide">{u.serial}</td>
                    <td className="whitespace-nowrap tabular-nums">{fmt.money2(Number(u.unitCost))}</td>
                  </tr>
                ))}
                <tr className="bg-[#f8f9fb] font-bold [&>td]:border [&>td]:border-[#d7dae0] [&>td]:px-2.5 [&>td]:py-2">
                  <td colSpan={4}>{t('custodyTotal')} ({fmt.num(c.units.length)})</td>
                  <td className="whitespace-nowrap tabular-nums">{fmt.money2(c.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1.5 text-[11px] text-[#6b7280]">{t('custodyValueNote')}</p>

            <p className="mt-6 rounded border border-[#d7dae0] bg-[#f8f9fb] px-4 py-3 text-sm leading-7">{t('custodyPledge')}</p>

            <footer className="mt-8 grid gap-8 text-center text-xs text-[#4b5563] sm:grid-cols-3">
              <div>
                <div className="flex h-20 items-end justify-center border-b border-[#14171c] pb-1">
                  {c.signature && <img src={c.signature} alt="" className="max-h-[72px] max-w-full" />}
                </div>
                <p className="mt-1.5 font-semibold text-[#14171c]">{c.signerName ?? t('custodyCustodian')}</p>
                <p>{t('custodyCustodian')} — {t('signatureLabel')}</p>
                {c.signerIdNo && <p dir="ltr">ID: {c.signerIdNo}</p>}
                {c.signedAt && <p>{fmt.date(c.signedAt)}</p>}
              </div>
              <div>
                <div className="h-20 border-b border-[#14171c]" />
                <p className="mt-1.5 font-semibold text-[#14171c]">{c.issuedBy.fullName}</p>
                <p>{t('custodyIssuer')} — {t('signatureLabel')}</p>
              </div>
              <div>
                <div className="h-20 border-b border-[#14171c]" />
                <p className="mt-1.5 font-semibold text-[#14171c]">{c.approvedBy ?? '—'}</p>
                <p>{t('custodyApprover')} — {t('signatureLabel')}</p>
              </div>
            </footer>
            <p className="mt-6 text-center text-[11px] text-[#9ca3af]">{t('generatedBy')}</p>
          </article>

          {/* ملصقات الأرقام التسلسلية (تُطبع وتُلصق على الأجهزة) */}
          <section className="no-print-hint">
            <h3 className="no-print mb-2 text-sm font-semibold text-muted">{t('custodyLabels')}</h3>
            <div dir={dir} className={cn('grid grid-cols-2 gap-3 rounded-lg bg-white p-4 text-[#14171c] sm:grid-cols-3', mode === 'labels' && 'print-area')}>
              {c.units.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded border border-dashed border-[#9ca3af] p-2.5">
                  {qrs[u.serial] ? <img src={qrs[u.serial]} alt="" width={64} height={64} /> : <div className="size-16 bg-[#eef0f3]" />}
                  <div className="min-w-0 leading-5">
                    <p className="text-[11px] text-[#6b7280]">{t('appName')}</p>
                    <p className="truncate text-sm font-semibold">{u.item.name.trim()}</p>
                    <p className="text-base font-bold tracking-wide" dir="ltr">{u.serial}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}
