'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, PageHeader, Spinner, TableWrap, td, th } from '@/components/ui';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string; email: string; username: string | null; fullName: string; role: Role; active: boolean;
  department: { id: string; name: string } | null; branch: { id: string; name: string } | null;
}
interface Branch { id: string; name: string }
interface Dept { id: string; name: string }

const ROLES: Role[] = ['EMPLOYEE', 'DEPT_MANAGER', 'WAREHOUSE_KEEPER', 'ADMIN'];

export default function AdminPage() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => { if (ready && user && user.role !== 'ADMIN') router.replace('/'); }, [ready, user, router]);
  if (user?.role !== 'ADMIN') return <Spinner />;

  return (
    <>
      <PageHeader title={t('navAdmin')} />
      <Users selfId={user.id} />
    </>
  );
}

/* ------------------------------- المستخدمون ------------------------------- */
function Users({ selfId }: { selfId: string }) {
  const { t } = useI18n();
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api<AdminUser[]>('/admin/users') });
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const pg = usePagination(users.data ?? []);

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus className="size-4" /> {t('newUser')}</Button></div>
      <Card>
        {users.isLoading ? <Spinner /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : (
          <TableWrap>
            <thead><tr>
              <th className={th}>{t('fullName')}</th><th className={th}>{t('role')}</th><th className={th}>{t('department')}</th>
              <th className={th}>{t('branch')}</th><th className={th}>{t('status')}</th><th className={th} />
            </tr></thead>
            <tbody>
              {pg.slice.map((u) => (
                <tr key={u.id} className={cn('hover:bg-white/5', !u.active && 'opacity-60')}>
                  <td className={td}><p className="font-medium">{u.fullName}</p><p className="text-xs text-muted" dir="ltr">{u.username} · {u.email}</p></td>
                  <td className={td}>{t(`role_${u.role}`)}</td>
                  <td className={cn(td, 'text-muted')}>{u.department?.name ?? '—'}</td>
                  <td className={cn(td, 'text-muted')}>{u.branch?.name ?? '—'}</td>
                  <td className={td}><Badge tone={u.active ? 'ok' : 'muted'}>{u.active ? t('active') : t('inactive')}</Badge></td>
                  <td className={td}><Button variant="ghost" size="sm" onClick={() => setEditing(u)}>{t('edit')}</Button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </Card>
      {editing && <UserDialog user={editing === 'new' ? null : editing} isSelf={editing !== 'new' && editing.id === selfId} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserDialog({ user, isSelf, onClose }: { user: AdminUser | null; isSelf: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<Branch[]>('/branches') });
  const [f, setF] = useState({
    username: user?.username ?? '', email: user?.email ?? '', fullName: user?.fullName ?? '', password: '', role: (user?.role ?? 'EMPLOYEE') as Role,
    branchId: user?.branch?.id ?? '', departmentId: user?.department?.id ?? '', active: user?.active ?? true,
  });
  const needsDept = f.role === 'EMPLOYEE' || f.role === 'DEPT_MANAGER';
  const needsBranch = f.role !== 'ADMIN';
  const deptsQ = useQuery({ queryKey: ['departments'], queryFn: () => api<Dept[]>('/departments') });
  const depts = deptsQ.data ?? [];

  const save = useMutation({
    mutationFn: () => {
      const body = {
        fullName: f.fullName, role: f.role, active: f.active,
        branchId: needsBranch ? f.branchId : undefined, departmentId: needsDept ? f.departmentId : undefined,
        password: f.password || undefined,
      };
      return user
        ? api(`/admin/users/${user.id}`, { method: 'PATCH', json: body })
        : api('/admin/users', { method: 'POST', json: { ...body, username: f.username, email: f.email, active: undefined } });
    },
    onSuccess: () => { toast.success(t('saved')); void qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={user ? t('editUser') : t('newUser')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label={t('fullName')}><input className="field" required minLength={3} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label={t('username')} hint={t('usernameRule')}><input className="field" dir="ltr" required disabled={!!user} pattern="[A-Za-z0-9._-]{1,32}" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label={t('email')}><input className="field" type="email" dir="ltr" required disabled={!!user} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={user ? t('setPassword') : t('password')} hint={user ? t('passwordKeep') : t('passwordMin')}>
          <input className="field" type="password" dir="ltr" autoComplete="new-password" required={!user} minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('role')}>
            <select className="field" disabled={isSelf} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
            </select>
          </Field>
          {needsBranch && (
            <Field label={t('branch')}>
              <select className="field" required value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
                <option value="">—</option>{branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
          {needsDept && (
            <Field label={t('department')}>
              <select className="field" required value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
                <option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        {user && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[#0a84ff]" disabled={isSelf} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t('active')}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{t('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

