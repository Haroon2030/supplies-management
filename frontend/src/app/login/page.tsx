'use client';

import { Boxes } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

const DEMO = [
  { username: '8', pw: 'Passw0rd!', role: 'role_EMPLOYEE', name: 'سارة · تقنية المعلومات' },
  { username: '3', pw: 'Passw0rd!', role: 'role_DEPT_MANAGER', name: 'خالد · تقنية المعلومات' },
  { username: '2', pw: 'Passw0rd!', role: 'role_WAREHOUSE_KEEPER', name: 'ماجد · المستودع' },
  { username: '1', pw: '', role: 'role_ADMIN', name: 'سلطان · النظام' },
] as const;

export default function LoginPage() {
  const { t, toggle } = useI18n();
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && user) router.replace('/'); }, [ready, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(username, password); router.replace('/'); }
    catch (err) { setError(err instanceof Error ? err.message : t('errorTitle')); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-accent text-[#ffffff]"><Boxes className="size-6" aria-hidden /></div>
            <div>
              <h1 className="text-xl font-bold">{t('appName')}</h1>
              <p className="text-sm text-muted">{t('appTagline')}</p>
            </div>
          </div>
          <button onClick={toggle} className="text-sm text-muted hover:text-fg">{t('lang')}</button>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label={t('username')} hint={t('usernameHint')}>
              <input className="field" type="text" inputMode="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={t('password')}>
              <input className="field" type="password" required autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>{t('signIn')}</Button>
          </form>
        </Card>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">{t('demoAccounts')} <span className="font-normal text-muted">— {t('demoHint')} <bdi dir="ltr" className="font-mono text-fg/80">Passw0rd!</bdi></span></p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.username}
                type="button"
                onClick={() => { setUsername(d.username); setPassword(d.pw); }}
                className="glass rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-white/10"
              >
                <span className="block text-sm font-semibold">{t(d.role)}</span>
                <span className="block truncate text-xs text-muted">{d.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
