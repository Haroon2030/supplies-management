'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 15_000, refetchOnWindowFocus: true, refetchOnReconnect: true,
          // انقطاع الاتصال بالخادم (status 0) غالباً مؤقت: نعيد المحاولة بتأخير متصاعد (1s, 2s, 4s, 8s) قبل إظهار الخطأ
          retry: (count, err) => ((err as { status?: number }).status === 0 ? count < 4 : count < 1),
          retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        },
      },
    }),
  );
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          {children}
          <Toaster theme="dark" position="bottom-center" richColors toastOptions={{ className: '!font-sans' }} />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
