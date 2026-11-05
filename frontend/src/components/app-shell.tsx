'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Bell, Boxes, Info, ClipboardList, Languages, LayoutDashboard, LogOut, Menu, PackageCheck, PlusCircle, Receipt, Settings2, ShoppingCart, Users, X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n, type Key } from '@/lib/i18n';
import type { Dashboard, Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Spinner } from './ui';

interface NavItem { href: string; label: Key; icon: ComponentType<{ className?: string }>; roles?: Role[]; badge?: 'manager' | 'warehouse' | 'edit' }

/** تسمية "الطلبات" تتغير بتغير الدور: طلباتي / طلبات الإدارة / طابور الصرف */
const NAV: NavItem[] = [
  { href: '/', label: 'navDashboard', icon: LayoutDashboard },
  { href: '/requests', label: 'navMyRequests', icon: ClipboardList, roles: ['EMPLOYEE'], badge: 'edit' },
  { href: '/requests', label: 'navApprovals', icon: ClipboardList, roles: ['DEPT_MANAGER'], badge: 'manager' },
  { href: '/requests', label: 'navWarehouseQueue', icon: PackageCheck, roles: ['WAREHOUSE_KEEPER'], badge: 'warehouse' },
  { href: '/requests', label: 'navRequests', icon: ClipboardList, roles: ['ADMIN'] },
  { href: '/requests/new', label: 'navNewRequest', icon: PlusCircle, roles: ['EMPLOYEE', 'DEPT_MANAGER'] },
  { href: '/inventory', label: 'navInventory', icon: Boxes, roles: ['WAREHOUSE_KEEPER'] },
  { href: '/invoices', label: 'navInvoices', icon: Receipt, roles: ['WAREHOUSE_KEEPER'] },
  { href: '/purchase-requests', label: 'navPurchase', icon: ShoppingCart, roles: ['WAREHOUSE_KEEPER'] },
  { href: '/setup', label: 'navSetup', icon: Settings2, roles: ['ADMIN'] },
  { href: '/admin', label: 'navAdmin', icon: Users, roles: ['ADMIN'] },
  { href: '/reports', label: 'navReports', icon: BarChart3, roles: ['WAREHOUSE_KEEPER', 'DEPT_MANAGER'] },
  { href: '/about', label: 'navAbout', icon: Info },
];

/** المرحلة التي تنتظر إجراء من كل دور (تغذي الجرس). */
const ACTION: Partial<Record<Role, { stage: string; key: 'pendingManager' | 'pendingWarehouse' | 'needsEdit' }>> = {
  EMPLOYEE: { stage: 'edit', key: 'needsEdit' },
  DEPT_MANAGER: { stage: 'manager', key: 'pendingManager' },
  WAREHOUSE_KEEPER: { stage: 'warehouse', key: 'pendingWarehouse' },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { t, toggle } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  useEffect(() => setOpen(false), [pathname]);

  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), enabled: !!user, refetchInterval: 30_000 });

  if (!ready || !user) return <Spinner />;

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role) || user.role === 'ADMIN')
    // المدير العام: مدخل "الطلبات" الخاص به فقط، وبلا "طلب جديد" لأنه غير مرتبط بإدارة
    .filter((n) => user.role !== 'ADMIN' || !n.roles || n.roles.includes('ADMIN') || !n.href.startsWith('/requests'));

  const action = ACTION[user.role];
  const pending = action && dash.data ? dash.data.pipeline[action.key] : 0;
  const badgeValue = (b?: NavItem['badge']) => {
    const p = dash.data?.pipeline;
    if (!p || !b) return 0;
    return b === 'manager' ? p.pendingManager : b === 'warehouse' ? p.pendingWarehouse : p.needsEdit;
  };

  // أطول مسار يطابق الصفحة الحالية هو العنصر النشط
  const activeHref = items
    .filter((n) => (n.href === '/' ? pathname === '/' : pathname === n.href || pathname.startsWith(n.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const iconBtn = 'glass relative grid size-11 shrink-0 place-items-center rounded-full text-fg/90 hover:bg-white/15';

  return (
    <div className="app-chrome min-h-screen p-3 sm:p-4 lg:p-5">
      {/* شريط علوي عائم: المحتوى يمر تحته */}
      <header className="glass sticky top-3 z-30 mb-4 flex items-center gap-3 rounded-[28px] px-4 py-2.5 sm:px-5 lg:top-5">
        <button onClick={() => setOpen((o) => !o)} aria-label="menu" aria-expanded={open} className={cn(iconBtn, 'lg:hidden')}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[14px] bg-gradient-to-br from-accent to-plum text-white shadow-[0_6px_18px_-6px_rgb(10_132_255/0.8)]" aria-hidden>
            <Boxes className="size-6" />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[17px] font-semibold">{t('appName')}</span>
            <span className="block text-xs text-muted">{t('appTagline')}</span>
          </span>
        </Link>

        <div className="ms-auto flex items-center gap-2 sm:gap-3">
          <div className="glass flex items-center gap-3 rounded-full p-1.5 sm:pe-5">
            <span className="relative grid size-9 place-items-center rounded-full bg-gradient-to-br from-info to-accent text-base font-semibold text-black/80" aria-hidden>
              {user.fullName.trim().charAt(0)}
              <span className="absolute -bottom-0.5 -end-0.5 size-3 rounded-full bg-ok ring-2 ring-[#1c1c1e]" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold">{user.fullName}</span>
              <span className="block text-xs text-muted">{t(`role_${user.role}`)}{user.department ? ` · ${user.department.name}` : ''}</span>
            </span>
          </div>

          <Link href={action ? `/requests?stage=${action.stage}` : '/requests'} className={iconBtn} aria-label={pending ? `${pending}` : t('navRequests')}>
            <Bell className="size-5" />
            {pending > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-semibold leading-5 text-white ring-2 ring-[#1c1c1e]">
                {pending > 99 ? '99+' : pending}
              </span>
            )}
          </Link>
          <button onClick={toggle} className={iconBtn} aria-label={t('lang')} title={t('lang')}><Languages className="size-5" /></button>
          <button onClick={logout} className={cn(iconBtn, 'hover:text-bad')} aria-label={t('signOut')} title={t('signOut')}><LogOut className="size-5" /></button>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[250px_1fr] lg:items-start lg:gap-4">
        {open && <button aria-label={t('close')} className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

        {/* قائمة جانبية: كبسولات كبيرة، النشطة متوهجة */}
        <aside
          className={cn(
            'glass z-30 rounded-[28px] p-3 lg:sticky lg:top-[104px] lg:block',
            open ? 'fixed inset-x-3 top-[84px] max-h-[calc(100vh-100px)] overflow-y-auto' : 'hidden',
          )}
        >
          <nav aria-label="main" className="flex flex-col gap-2">
            {items.map((n) => {
              const active = n.href === activeHref;
              const count = badgeValue(n.badge);
              return (
                <Link
                  key={n.href + n.label}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium',
                    active ? 'nav-active' : 'bg-white/[0.04] text-fg/80 ring-1 ring-inset ring-white/8 hover:bg-white/10 hover:text-fg',
                  )}
                >
                  <n.icon className="size-5 shrink-0" aria-hidden />
                  <span className="flex-1">{t(n.label)}</span>
                  {count > 0 && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', active ? 'bg-white/25 text-white' : 'bg-accent/20 text-accent-soft')}>{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="mt-4 min-w-0 lg:mt-0">{children}</main>
      </div>
    </div>
  );
}
