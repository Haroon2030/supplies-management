'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useI18n, type Key } from '@/lib/i18n';
import type { RequestRow, RequestStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button, Card, EmptyState, Spinner } from './ui';

interface Column { id: string; label: Key; statuses: RequestStatus[]; dot: string; chip: string; hideWhenEmpty?: boolean }

/** مراحل الطلب بترتيب مسارها؛ "يحتاج تعديل" تظهر فقط عند وجود طلبات فيها. */
const COLUMNS: Column[] = [
  { id: 'manager', label: 'stageManager', statuses: ['PENDING_MANAGER'], dot: 'bg-warn', chip: 'bg-warn/15 text-warn' },
  { id: 'edit', label: 'st_NEEDS_EDIT', statuses: ['NEEDS_EDIT'], dot: 'bg-plum', chip: 'bg-plum/15 text-plum', hideWhenEmpty: true },
  { id: 'warehouse', label: 'stageWarehouse', statuses: ['PENDING_WAREHOUSE'], dot: 'bg-accent', chip: 'bg-accent/15 text-accent-soft' },
  { id: 'purchase', label: 'stagePurchase', statuses: ['AWAITING_PURCHASE', 'PARTIALLY_ISSUED'], dot: 'bg-info', chip: 'bg-info/15 text-info' },
  { id: 'issued', label: 'stageIssued', statuses: ['ISSUED'], dot: 'bg-ok', chip: 'bg-ok/15 text-ok' },
];

const PER_COLUMN = 3;

export function KanbanBoard({ rows, loading, canCreate }: { rows: RequestRow[] | undefined; loading: boolean; canCreate: boolean }) {
  const { t, fmt } = useI18n();
  const cols = useMemo(
    () => COLUMNS.map((c) => ({ ...c, items: (rows ?? []).filter((r) => c.statuses.includes(r.status)) })).filter((c) => !c.hideWhenEmpty || c.items.length > 0),
    [rows],
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight">{t('boardTitle')}</h2>
        <div className="flex items-center gap-2">
          <Button variant="glass" size="sm" asChild><Link href="/requests">{t('showAll')}</Link></Button>
          {canCreate && <Button size="sm" asChild><Link href="/requests/new"><Plus className="size-4" /> {t('newRequest')}</Link></Button>}
        </div>
      </div>

      {loading ? <Spinner /> : !rows?.length ? (
        <EmptyState title={t('emptyRequests')} hint={t('emptyRequestsHint')} />
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {cols.map((c) => (
            <section key={c.id} aria-label={t(c.label)} className="min-w-[168px] flex-1 rounded-[20px] bg-black/25 p-3 ring-1 ring-inset ring-white/8">
              <Link href={`/requests?stage=${c.id}`} className="mb-3 flex items-center gap-2 rounded-lg px-1 py-0.5 hover:text-white">
                <span className={cn('size-2.5 rounded-full', c.dot)} aria-hidden />
                <h3 className="flex-1 text-sm font-semibold">{t(c.label)}</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums">{fmt.num(c.items.length)}</span>
              </Link>

              <ul className="space-y-2.5">
                {c.items.slice(0, PER_COLUMN).map((r) => {
                  const units = r.lines.reduce((s, l) => s + l.quantity, 0);
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/requests/${r.id}`}
                        className="block rounded-2xl bg-white/[0.07] p-3 ring-1 ring-inset ring-white/10 hover:bg-white/[0.12]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{t('requestNo')} <span className="tabular-nums">{r.number}</span></p>
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-info to-accent text-[11px] font-semibold text-black/80" aria-hidden>
                            {r.requester.fullName.trim().charAt(0)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">{r.requester.fullName}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', c.chip)}>{r.department.name}</span>
                        </div>
                        <p className="mt-2 flex flex-wrap justify-between gap-x-2 text-[11px] text-muted tabular-nums">
                          <span>{fmt.num(units)} {t('units')}</span>
                          <span>{fmt.date(r.createdAt)}</span>
                        </p>
                      </Link>
                    </li>
                  );
                })}
                {c.items.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted">{t('noCardsHere')}</li>}
              </ul>

              {c.items.length > PER_COLUMN && (
                <Link href={`/requests?stage=${c.id}`} className="mt-2 block rounded-xl py-1.5 text-center text-xs font-medium text-accent-soft hover:bg-white/8">
                  <bdi dir="ltr">+{fmt.num(c.items.length - PER_COLUMN)}</bdi>
                </Link>
              )}
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
