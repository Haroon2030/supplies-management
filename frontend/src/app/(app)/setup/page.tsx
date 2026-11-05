'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface SetupItem {
  id: string; sku: string; name: string; description: string | null; barcode: string | null; unit: string;
  categoryId: string; category: { id: string; name: string };
}
interface Category { id: string; name: string }
interface Branch { id: string; name: string; code: string | null; city: string | null }

type Tab = 'items' | 'branches' | 'departments' | 'sections';
const HINT = { items: 'setupItemsHint', branches: 'setupBranchesHint', departments: 'setupDeptsHint', sections: 'setupSectionsHint' } as const;
const TAB_LABEL = { items: 'tabItems', branches: 'tabBranches', departments: 'tabDepartments', sections: 'tabSections' } as const;

export default function SetupPage() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('items');

  useEffect(() => { if (ready && user && user.role !== 'ADMIN') router.replace('/'); }, [ready, user, router]);
  if (user?.role !== 'ADMIN') return <Spinner />;

  return (
    <>
      <PageHeader title={t('navSetup')} subtitle={t(HINT[tab])} />
      <div role="tablist" className="mb-4 flex gap-2">
        {(['items', 'branches', 'departments', 'sections'] as const).map((k) => (
          <button
            key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
              tab === k ? 'bg-accent/18 text-accent-soft ring-accent/40' : 'text-muted ring-white/12 hover:bg-white/6 hover:text-fg')}
          >
            {t(TAB_LABEL[k])}
          </button>
        ))}
      </div>
      {tab === 'items' ? <ItemsTab /> : tab === 'branches' ? <BranchesTab /> : <NameListTab key={tab} kind={tab} />}
    </>
  );
}

/* --------------------------------- الأصناف --------------------------------- */
function ItemsTab() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['items'], queryFn: () => api<SetupItem[]>('/items') });
  const [editing, setEditing] = useState<SetupItem | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const n = search.trim().toLowerCase();
    return (q.data ?? []).filter((i) => !n || `${i.name} ${i.sku} ${i.barcode ?? ''}`.toLowerCase().includes(n));
  }, [q.data, search]);
  const pg = usePagination(rows, [search]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          className="field max-w-sm" type="search" placeholder={t('searchItems')} aria-label={t('search')}
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => setEditing('new')}><Plus className="size-4" /> {t('newItem')}</Button>
      </div>
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? <EmptyState title={t('none')} /> : (
          <TableWrap>
            <thead><tr>
              <th className={th}>{t('itemNumber')}</th><th className={th}>{t('itemName')}</th><th className={th}>{t('itemDescription')}</th>
              <th className={th}>{t('barcode')}</th><th className={th}>{t('category')}</th><th className={th} />
            </tr></thead>
            <tbody>
              {pg.slice.map((i) => (
                <tr key={i.id} className="hover:bg-white/5">
                  <td className={cn(td, 'tabular-nums')} dir="ltr">{i.sku}</td>
                  <td className={cn(td, 'font-medium')}>{i.name}</td>
                  <td className={cn(td, 'max-w-[26ch] truncate text-muted')} title={i.description ?? undefined}>{i.description || '—'}</td>
                  <td className={cn(td, 'tabular-nums text-muted')} dir="ltr">{i.barcode || '—'}</td>
                  <td className={cn(td, 'text-muted')}>{i.category.name}</td>
                  <td className={td}><Button variant="ghost" size="sm" onClick={() => setEditing(i)}><Pencil className="size-3.5" /> {t('edit')}</Button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {editing && <ItemDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ItemDialog({ item, onClose }: { item: SetupItem | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const [f, setF] = useState({
    sku: item?.sku ?? '', name: item?.name ?? '', description: item?.description ?? '', barcode: item?.barcode ?? '',
    categoryId: item?.categoryId ?? '', unit: item?.unit ?? 'قطعة',
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: f.name, description: f.description, barcode: f.barcode, categoryId: f.categoryId, unit: f.unit };
      return item ? api(`/items/${item.id}`, { method: 'PATCH', json: body }) : api('/items', { method: 'POST', json: { ...body, sku: f.sku } });
    },
    onSuccess: () => {
      toast.success(t('saved'));
      for (const k of ['items', 'inventory', 'purchase-requests', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={item ? t('editItem') : t('newItem')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={t('itemName')}><input className="field" required minLength={2} autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('itemNumber')}>
            <input className="field" dir="ltr" required minLength={2} disabled={!!item} value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} />
          </Field>
          <Field label={t('barcode')}>
            <input className="field tabular-nums" dir="ltr" inputMode="numeric" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
          </Field>
          <Field label={t('category')}>
            <select className="field" required value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">—</option>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('unit')}><input className="field" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        </div>
        <Field label={t('itemDescription')}>
          <textarea className="field min-h-24" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* --------------------------------- الإدارات --------------------------------- */
// الإدارة كيان مستقل: اسم فقط، غير مرتبط بالفروع.
interface Dept { id: string; name: string }

const NAME_LIST = {
  departments: { key: 'departments', path: 'departments', name: 'deptName', add: 'newDepartment', edit: 'editDepartment', empty: 'noDepartments' },
  sections: { key: 'sections', path: 'sections', name: 'sectionName', add: 'newSection', edit: 'editSection', empty: 'noSections' },
} as const;
type NameKind = keyof typeof NAME_LIST;

/** قائمة أسماء مستقلة (الإدارات أو الأقسام): جدول 8 صفوف + ترقيم + إضافة وتعديل. */
function NameListTab({ kind }: { kind: NameKind }) {
  const { t } = useI18n();
  const L = NAME_LIST[kind];
  const q = useQuery({ queryKey: [L.key], queryFn: () => api<Dept[]>(`/${L.path}`) });
  const [editing, setEditing] = useState<Dept | 'new' | null>(null);
  const pg = usePagination(q.data ?? []);

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus className="size-4" /> {t(L.add)}</Button></div>
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title={t(L.empty)} /> : (
          <TableWrap>
            <thead><tr><th className={th}>{t(L.name)}</th><th className={th} /></tr></thead>
            <tbody>
              {pg.slice.map((d) => (
                <tr key={d.id} className="hover:bg-white/5">
                  <td className={cn(td, 'font-medium')}>{d.name}</td>
                  <td className={td}><Button variant="ghost" size="sm" onClick={() => setEditing(d)}><Pencil className="size-3.5" /> {t('edit')}</Button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {editing && <NameDialog kind={kind} row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function NameDialog({ kind, row: dept, onClose }: { kind: NameKind; row: Dept | null; onClose: () => void }) {
  const { t } = useI18n();
  const L = NAME_LIST[kind];
  const qc = useQueryClient();
  const [name, setName] = useState(dept?.name ?? '');
  const save = useMutation({
    mutationFn: () => dept
      ? api(`/admin/${L.path}/${dept.id}`, { method: 'PATCH', json: { name } })
      : api(`/admin/${L.path}`, { method: 'POST', json: { name } }),
    onSuccess: () => { toast.success(t('saved')); void qc.invalidateQueries({ queryKey: [L.key] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={dept ? t(L.edit) : t(L.add)}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={t(L.name)}><input className="field" required minLength={2} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------------------- الفروع ---------------------------------- */
function BranchesTab() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const pg = usePagination(q.data ?? []);

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus className="size-4" /> {t('newBranch')}</Button></div>
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title={t('none')} /> : (
          <TableWrap>
            <thead><tr><th className={th}>{t('branchNumber')}</th><th className={th}>{t('branchName')}</th><th className={th}>{t('city')}</th><th className={th} /></tr></thead>
            <tbody>
              {pg.slice.map((b) => (
                <tr key={b.id} className="hover:bg-white/5">
                  <td className={cn(td, 'tabular-nums')} dir="ltr">{b.code || '—'}</td>
                  <td className={cn(td, 'font-medium')}>{b.name}</td>
                  <td className={cn(td, 'text-muted')}>{b.city || '—'}</td>
                  <td className={td}><Button variant="ghost" size="sm" onClick={() => setEditing(b)}><Pencil className="size-3.5" /> {t('edit')}</Button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {editing && <BranchDialog branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BranchDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(branch?.name ?? '');
  const [code, setCode] = useState(branch?.code ?? '');
  const [city, setCity] = useState(branch?.city ?? '');
  const save = useMutation({
    mutationFn: () => branch
      ? api(`/admin/branches/${branch.id}`, { method: 'PATCH', json: { name, code, city } })
      : api('/admin/branches', { method: 'POST', json: { name, code: code || undefined, city: city || undefined } }),
    onSuccess: () => { toast.success(t('saved')); void qc.invalidateQueries({ queryKey: ['branches'] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={branch ? t('editBranch') : t('newBranch')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={t('branchName')}><input className="field" required minLength={2} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('branchNumber')}><input className="field tabular-nums" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Field label={t('city')}><input className="field" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
