'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Item } from '@/lib/types';
import { Button, Card, CardHeader, Field, Spinner } from './ui';

export interface FormLine { itemId: string; quantity: number }
export interface FormValue { justification: string; lines: FormLine[]; departmentId?: string; branchId?: string }

/** نموذج مشترك لإنشاء الطلب وتعديله بعد إعادته من المدير. `withPlacement`: اختيار الإدارة والفرع (للمدير العام وأمين المستودع). */
export function RequestForm({
  initial, submitLabel, busy, onSubmit, withPlacement,
}: {
  initial?: FormValue; submitLabel: string; busy?: boolean; onSubmit: (v: FormValue) => void; withPlacement?: boolean;
}) {
  const { t } = useI18n();
  const depts = useQuery({ queryKey: ['departments'], queryFn: () => api<{ id: string; name: string }[]>('/departments'), enabled: !!withPlacement });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<{ id: string; name: string }[]>('/branches'), enabled: !!withPlacement });
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
      className="space-y-6"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ justification: justification.trim(), lines, ...(withPlacement ? { departmentId, branchId } : {}) }); }}
    >
      {withPlacement && (
        <Card className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label={t('branch')}>
            <select className="field" required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">—</option>{branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label={t('department')}>
            <select className="field" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">—</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </Card>
      )}
      <Card>
        <CardHeader title={t('item')} />
        <div className="space-y-3 p-5">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2 sm:gap-3">
              <Field label={idx === 0 ? t('item') : ''}>
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
              </Field>
              <Field label={idx === 0 ? t('qty') : ''}>
                <div className="relative">
                  <input
                    className="field tabular-nums" type="number" min={1} step={1} required value={l.quantity}
                    aria-label={t('qty')}
                    onChange={(e) => patch(idx, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </div>
              </Field>
              <Button type="button" variant="ghost" size="md" disabled={lines.length === 1} aria-label="remove" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4" />
              </Button>
              {l.itemId && <p className="col-span-3 -mt-1 text-xs text-muted">{t('unit')}: {unitOf(l.itemId)}</p>}
            </div>
          ))}
          <Button type="button" variant="glass" size="sm" onClick={() => setLines((ls) => [...ls, { itemId: '', quantity: 1 }])}>
            <Plus className="size-4" /> {t('addItem')}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <Field label={t('justification')}>
          <textarea className="field min-h-24" placeholder={t('justificationPh')} value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={500} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!valid} loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
