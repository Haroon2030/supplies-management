'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui';
import { RequestForm } from '@/components/request-form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { RequestDetail } from '@/lib/types';

export default function NewRequestPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (v: { justification: string; lines: { itemId: string; quantity: number }[]; departmentId?: string; branchId?: string }) =>
      api<RequestDetail>('/requests', { method: 'POST', json: { ...v, justification: v.justification || undefined } }),
    onSuccess: (r) => {
      toast.success(t('requestSent'));
      void qc.invalidateQueries({ queryKey: ['requests'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/requests/${r.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('newRequest')} subtitle={user?.role === 'DEPT_MANAGER' ? t('autoApproved') : user?.department ? `${user.department.name} · ${user.branch?.name ?? ''}` : undefined} />
      <RequestForm withPlacement={user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_KEEPER'} submitLabel={t('submitRequest')} busy={create.isPending} onSubmit={(v) => create.mutate(v)} />
    </div>
  );
}
