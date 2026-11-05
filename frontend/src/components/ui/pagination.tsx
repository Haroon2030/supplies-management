'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const PAGE_SIZE = 8;

/** ترقيم من جهة العميل: يعيد الصفحة الحالية فقط، ويرجع للصفحة 1 عند تغيّر التصفية (deps). */
export function usePagination<T>(items: T[], deps: unknown[] = [], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), deps);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const slice = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return { page, pages, setPage, slice, total: items.length, from: items.length ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, items.length) };
}

/** أرقام الصفحات مع نقاط حذف: 1 … 4 5 6 … 20 */
function windowed(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
}

export function Pagination({ page, pages, total, from, to, onPage }: {
  page: number; pages: number; total: number; from: number; to: number; onPage: (p: number) => void;
}) {
  const { t, fmt, dir } = useI18n();
  if (total <= PAGE_SIZE) return null;
  // في الاتجاه العربي "السابق" على اليمين فسهمه يشير لليمين
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const btn = 'grid size-9 min-w-9 place-items-center rounded-full px-2 text-sm font-medium tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-35';

  return (
    <nav aria-label={t('pagination')} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
      <p className="text-sm text-muted tabular-nums">
        {fmt.num(from)}–{fmt.num(to)} {t('ofCount')} {fmt.num(total)}
      </p>
      <div className="flex items-center gap-1">
        <button className={cn(btn, 'text-muted hover:bg-white/10 hover:text-fg')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('prevPage')}>
          <Prev className="size-4" />
        </button>
        {windowed(page, pages).map((n, i) =>
          n === '…' ? <span key={`e${i}`} className="px-1 text-muted" aria-hidden>…</span> : (
            <button
              key={n} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} aria-label={`${t('pageWord')} ${n}`}
              className={cn(btn, n === page ? 'bg-accent text-white shadow-[0_6px_18px_-6px_rgb(10_132_255/0.8)]' : 'text-fg/80 hover:bg-white/10')}
            >
              {fmt.num(n)}
            </button>
          ),
        )}
        <button className={cn(btn, 'text-muted hover:bg-white/10 hover:text-fg')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('nextPage')}>
          <Next className="size-4" />
        </button>
      </div>
    </nav>
  );
}
