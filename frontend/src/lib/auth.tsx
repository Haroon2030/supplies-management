'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { Profile, Role } from './types';

interface AuthCtx {
  user: Profile | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => setHasToken(!!tokenStore.get()), []);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Profile>('/auth/me'),
    enabled: hasToken === true,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ accessToken: string; user: Profile }>('/auth/login', { method: 'POST', json: { username, password } });
    tokenStore.set(res.accessToken);
    qc.clear();
    qc.setQueryData(['me'], res.user);
    setHasToken(true);
  }, [qc]);

  const logout = useCallback(() => {
    tokenStore.clear();
    qc.clear();
    setHasToken(false);
    router.replace('/login');
  }, [qc, router]);

  const user = hasToken ? me.data ?? null : null;
  const ready = hasToken !== null && (hasToken === false || !me.isLoading);
  const can = useCallback((...roles: Role[]) => !!user && (user.role === 'ADMIN' || roles.includes(user.role)), [user]);

  return <Ctx.Provider value={{ user, ready, login, logout, can }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
