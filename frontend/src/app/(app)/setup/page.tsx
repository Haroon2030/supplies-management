'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus } from 'lucide-react';
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
interface Branch { id: string; name: string; code: string | null; city: string | null; departments: { id: string; name: string }[] }

type Tab = 'items' | 'branches' | 'departments';
const TAB_LABEL = { items: 'tabItems', branches: 'tabOrg', departments: 'tabDepartments' } as const;

export default function SetupPage() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('items');

  useEffect(() => { if (ready && user && user.role !== 'ADMIN') router.replace('/'); }, [ready, user, router]);
  if (user?.role !== 'ADMIN') return <Spinner />;

  return (
    <>
      <PageHeader title={t('navSetup')} subtitle={t(tab === 'items' ? 'setupItemsHint' : 'setupBranchesHint')} />
      <div role="tablist" className="mb-4 flex gap-2">
        {(['items', 'branches', 'departments'] as const).map((k) => (
          <button
            key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
              tab === k ? 'bg-accent/18 text-accent-soft ring-accent/40' : 'text-muted ring-white/12 hover:bg-white/6 hover:text-fg')}
          >
            {t(TAB_LABEL[k])}
          </button>
        ))}
      </div>
      {tab === 'items' ? <ItemsTab /> : tab === 'branches' ? <BranchesTab /> : <DepartmentsTab />}
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
interface DeptRow { id: string; name: string; branch: Branch }

function DepartmentsTab() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const [editing, setEditing] = useState<DeptRow | 'new' | null>(null);
  const rows = useMemo<DeptRow[]>(
    () => (q.data ?? []).flatMap((b) => b.departments.map((d) => ({ ...d, branch: b }))),
    [q.data],
  );
  const pg = usePagination(rows);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing('new')} disabled={!q.data?.length}><Plus className="size-4" /> {t('newDepartment')}</Button>
      </div>
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? <EmptyState title={t('noDepartments')} /> : (
          <TableWrap>
            <thead><tr><th className={th}>{t('deptName')}</th><th className={th}>{t('branch')}</th><th className={th}>{t('branchNumber')}</th><th className={th} /></tr></thead>
            <tbody>
              {pg.slice.map((d) => (
                <tr key={d.id} className="hover:bg-white/5">
                  <td className={cn(td, 'font-medium')}>{d.name}</td>
                  <td className={cn(td, 'text-muted')}>{d.branch.name}</td>
                  <td className={cn(td, 'tabular-nums text-muted')} dir="ltr">{d.branch.code || '—'}</td>
                  <td className={td}><Button variant="ghost" size="sm" onClick={() => setEditing(d)}><Pencil className="size-3.5" /> {t('edit')}</Button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {editing && <DeptDialog dept={editing === 'new' ? null : editing} branches={q.data ?? []} onClose={() => setEditing(null)} />}
    </>
  );
}

function DeptDialog({ dept, branches, onClose }: { dept: DeptRow | null; branches: Branch[]; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(dept?.name ?? '');
  const [branchId, setBranchId] = useState(dept?.branch.id ?? '');
  const save = useMutation({
    mutationFn: () => dept
      ? api(`/admin/departments/${dept.id}`, { method: 'PATCH', json: { name } })
      : api('/admin/departments', { method: 'POST', json: { name, branchId } }),
    onSuccess: () => { toast.success(t('saved')); void qc.invalidateQueries({ queryKey: ['branches'] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={dept ? t('editDepartment') : t('newDepartment')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={t('branch')}>
          <select className="field" required disabled={!!dept} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">—</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} — ${b.name}` : b.name}</option>)}
          </select>
        </Field>
        <Field label={t('deptName')}><input className="field" required minLength={2} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ----------------------------- الفروع والإدارات ----------------------------- */
type Dlg =
  | { kind: 'branch'; branch: Branch | null }
  | { kind: 'dept'; branch: Branch; dept: { id: string; name: string } | null };

function BranchesTab() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const [dlg, setDlg] = useState<Dlg | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setDlg({ kind: 'branch', branch: null })}><Plus className="size-4" /> {t('newBranch')}</Button></div>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <Card><EmptyState title={t('none')} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map((b) => (
            <Card key={b.id}>
              <CardHeader
                title={<span className="flex items-center gap-2"><Building2 className="size-4 text-accent-soft" aria-hidden />{b.name}</span>}
                hint={[b.code ? `${t('branchNumber')}: ${b.code}` : null, b.city].filter(Boolean).join(' · ') || undefined}
                action={
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" aria-label={t('editBranch')} onClick={() => setDlg({ kind: 'branch', branch: b })}><Pencil className="size-3.5" /></Button>
                    <Button variant="glass" size="sm" onClick={() => setDlg({ kind: 'dept', branch: b, dept: null })}><Plus className="size-4" /> {t('newDepartment')}</Button>
                  </span>
                }
              />
              <ul className="p-4 pt-3">
                {b.departments.length ? b.departments.map((d) => (
                  <li key={d.id} className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5">
                    <span>{d.name}</span>
                    <button
                      type="button" aria-label={t('editDepartment')} onClick={() => setDlg({ kind: 'dept', branch: b, dept: d })}
                      className="rounded-md p-1 text-muted hover:bg-white/8 hover:text-fg"
                    ><Pencil className="size-3.5" /></button>
                  </li>
                )) : <li className="px-3 py-4 text-sm text-muted">{t('noDepartments')}</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {dlg && <OrgDialog key={dlg.kind + (dlg.kind === 'branch' ? dlg.branch?.id : dlg.dept?.id) + dlg.branch?.id} dlg={dlg} onClose={() => setDlg(null)} />}
    </>
  );
}

function OrgDialog({ dlg, onClose }: { dlg: Dlg; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const isBranch = dlg.kind === 'branch';
  const [name, setName] = useState(isBranch ? dlg.branch?.name ?? '' : dlg.dept?.name ?? '');
  const [code, setCode] = useState(isBranch ? dlg.branch?.code ?? '' : '');
  const [city, setCity] = useState(isBranch ? dlg.branch?.city ?? '' : '');

  const save = useMutation({
    mutationFn: () => {
      if (dlg.kind === 'branch') {
        return dlg.branch
          ? api(`/admin/branches/${dlg.branch.id}`, { method: 'PATCH', json: { name, code, city } })
          : api('/admin/branches', { method: 'POST', json: { name, code: code || undefined, city: city || undefined } });
      }
      return dlg.dept
        ? api(`/admin/departments/${dlg.dept.id}`, { method: 'PATCH', json: { name } })
        : api('/admin/departments', { method: 'POST', json: { name, branchId: dlg.branch.id } });
    },
    onSuccess: () => { toast.success(t('saved')); void qc.invalidateQueries({ queryKey: ['branches'] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const title = isBranch
    ? (dlg.branch ? t('editBranch') : t('newBranch'))
    : `${dlg.dept ? t('editDepartment') : t('newDepartment')} — ${dlg.branch.name}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={isBranch ? t('branchName') : t('deptName')}>
          <input className="field" required minLength={2} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {isBranch && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('branchNumber')}><input className="field tabular-nums" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Field label={t('city')}><input className="field" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
