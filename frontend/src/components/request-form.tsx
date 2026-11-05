'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Item } from '@/lib/types';
import { Button, Card, CardHeader, Field, Spinner } from './ui';

export interface FormLine { itemId: string; quantity: number }
export interface FormValue { justification: string; lines: FormLine[]; departmentId?: string; branchId?: string; sectionId?: string }

/** نموذج مشترك لإنشاء الطلب وتعديله بعد إعادته من المدير. `withPlacement`: اختيار الإدارة والفرع (للمدير العام وأمين المستودع). */
export function RequestForm({
  initial, submitLabel, busy, onSubmit, withPlacement,
}: {
  initial?: FormValue; submitLabel: string; busy?: boolean; onSubmit: (v: FormValue) => void; withPlacement?: boolean;
}) {
  const { t } = useI18n();
  const depts = useQuery({ queryKey: ['departments'], queryFn: () => api<{ id: string; name: string }[]>('/departments'), enabled: !!withPlacement });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<{ id: string; name: string }[]>('/branches'), enabled: !!withPlacement });
  const sections = useQuery({ queryKey: ['sections'], queryFn: () => api<{ id: string; name: string }[]>('/sections'), staleTime: 60_000 });
  const [sectionId, setSectionId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const items = useQuery({ queryKey: ['items'], queryFn: () => api<Item[]>('/items'), staleTime: 5 * 60_000 });
  const [justification, setJustification] = useState(initial?.justification ?? '');
  const [lines, setLines] = useState<FormLine[]>(initial?.lines.length ? initial.lines : [{ itemId: '', quantity: 1 }]);

  const active = useMemo(() => (items.data ?? []).filter((i) => i.active), [items.data]);
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of active) m.set(i.category.name, [...(m.get(i.category.name) ?? []), i]);
    return [...m.entries()];
  }, [active]);
  const unitOf = (id: string) => active.find((i) => i.id === id)?.unit ?? '';

  const patch = (idx: number, p: Partial<FormLine>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const chosen = new Set(lines.map((l) => l.itemId));
  const valid = lines.length > 0 && lines.every((l) => l.itemId && l.quantity >= 1 && Number.isInteger(l.quantity))
    && (!withPlacement || (!!departmentId && !!branchId));

  if (items.isLoading) return <Spinner />;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ justification: justification.trim(), lines, ...(withPlacement ? { departmentId, branchId } : {}), ...(sectionId ? { sectionId } : {}) }); }}
    >
      {!initial && <Card>
        <CardHeader title={t('requestInfo')} hint={t('requestInfoHint')} />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {withPlacement && (
            <>
              <Field label={t('branch')}>
                <select className="field" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">{t('chooseBranch')}</option>
                  {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name.trim()}</option>)}
                </select>
              </Field>
              <Field label={t('department')}>
                <select className="field" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">{t('chooseDepartment')}</option>
                  {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name.trim()}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label={t('section')}>
            <select className="field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">{t('chooseSection')}</option>
              {sections.data?.map((s) => <option key={s.id} value={s.id}>{s.name.trim()}</option>)}
            </select>
          </Field>
        </div>
      </Card>}

      <Card>
        <CardHeader title={t('requestedItems')} hint={`${lines.length}`} />
        <div className="p-5">
          {!active.length && <p className="mb-4 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">{t('noItemsHint')}</p>}

          {/* ترويسة الأعمدة مرة واحدة بدل تكرارها في كل صف */}
          <div className="mb-2 hidden grid-cols-[2rem_1fr_8rem_2.75rem] gap-3 px-1 text-xs font-medium text-muted sm:grid">
            <span>#</span><span>{t('item')}</span><span>{t('qty')}</span><span />
          </div>

          <ul className="space-y-2.5">
            {lines.map((l, idx) => (
              <li key={idx} className="grid grid-cols-[2rem_1fr_2.75rem] items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-inset ring-white/8 sm:grid-cols-[2rem_1fr_8rem_2.75rem]">
                <span className="grid size-7 place-items-center rounded-full bg-accent/18 text-xs font-bold tabular-nums text-accent-soft">{idx + 1}</span>
                <div className="min-w-0">
                  <select className="field" required value={l.itemId} onChange={(e) => patch(idx, { itemId: e.target.value })} aria-label={t('item')}>
                    <option value="">{t('chooseItem')}</option>
                    {grouped.map(([cat, list]) => (
                      <optgroup key={cat} label={cat}>
                        {list.map((i) => (
                          <option key={i.id} value={i.id} disabled={chosen.has(i.id) && i.id !== l.itemId}>{i.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {l.itemId && <p className="mt-1 text-xs text-muted">{t('unit')}: {unitOf(l.itemId)}</p>}
                </div>
                <Button type="button" variant="ghost" size="md" className="px-0 sm:order-last" disabled={lines.length === 1} aria-label={t('removeRow')} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                  <Trash2 className="size-4" />
                </Button>
                <input
                  className="field tabular-nums col-span-3 sm:col-span-1" type="number" min={1} step={1} required value={l.quantity}
                  aria-label={t('qty')}
                  onChange={(e) => patch(idx, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                />
              </li>
            ))}
          </ul>

          <Button type="button" variant="glass" size="sm" className="mt-4" onClick={() => setLines((ls) => [...ls, { itemId: '', quantity: 1 }])}>
            <Plus className="size-4" /> {t('addItem')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('justification')} />
        <div className="p-5">
          <textarea className="field min-h-24" placeholder={t('justificationPh')} aria-label={t('justification')} value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={500} />
          <p className="mt-1.5 text-end text-xs tabular-nums text-muted">{justification.length}/500</p>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {!valid && <p className="text-sm text-muted">{t('completeRequest')}</p>}
        <Button type="submit" size="lg" disabled={!valid} loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
