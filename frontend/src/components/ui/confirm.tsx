'use client';

import { useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button, Dialog } from './index';

/**
 * تأكيد داخل التطبيق بدل window.confirm (الذي تحجبه بعض المتصفحات المدمجة فيبدو الزر "لا يستجيب").
 * الاستخدام: const { ask, dialog } = useConfirm();  ثم  ask(message, () => action())  و  {dialog} في الواجهة.
 */
export function useConfirm() {
  const { t } = useI18n();
  const [state, setState] = useState<{ message: string; onYes: () => void; tone: 'danger' | 'primary' } | null>(null);

  const ask = (message: string, onYes: () => void, tone: 'danger' | 'primary' = 'danger') => setState({ message, onYes, tone });

  const dialog: ReactNode = state && (
    <Dialog open onOpenChange={(o) => !o && setState(null)} title={t('confirmTitle')} description={state.message}>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" autoFocus onClick={() => setState(null)}>{t('cancel')}</Button>
        <Button type="button" variant={state.tone} onClick={() => { const f = state.onYes; setState(null); f(); }}>{t('confirmYes')}</Button>
      </div>
    </Dialog>
  );

  return { ask, dialog };
}
