'use client';

import { Boxes } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

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

        <p className="mt-5 text-center text-sm">
          <Link href="/about" className="font-semibold text-accent-soft hover:underline">{t('navAbout')}</Link>
        </p>
      </div>
    </div>
  );
}
