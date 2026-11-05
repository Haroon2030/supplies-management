'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Bell, Boxes, Info, ClipboardList, ClipboardSignature, LayoutDashboard, LogOut, Menu, PackageCheck, PackagePlus, PlusCircle, Receipt, Settings2, ShoppingCart, Users, X,
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

type NavGroup = 'home' | 'requests' | 'stock' | 'insight' | 'admin';
interface NavItem { href: string; label: Key; icon: ComponentType<{ className?: string }>; roles?: Role[]; badge?: 'manager' | 'warehouse' | 'edit'; group: NavGroup }

/** ترتيب المجموعات في القائمة وعنوان كل منها (الرئيسية بلا عنوان). */
const GROUPS: { id: NavGroup; label?: Key }[] = [
  { id: 'home' },
  { id: 'requests', label: 'navGroupRequests' },
  { id: 'stock', label: 'navGroupStock' },
  { id: 'insight', label: 'navGroupInsight' },
  { id: 'admin', label: 'navGroupAdmin' },
];

/** تسمية "الطلبات" تتغير بتغير الدور: طلباتي / طلبات الإدارة / طابور الصرف */
const NAV: NavItem[] = [
  { href: '/', label: 'navDashboard', icon: LayoutDashboard, group: 'home' },
  { href: '/requests', label: 'navMyRequests', icon: ClipboardList, roles: ['EMPLOYEE'], badge: 'edit', group: 'requests' },
  { href: '/requests', label: 'navApprovals', icon: ClipboardList, roles: ['DEPT_MANAGER', 'BRANCH_MANAGER'], badge: 'manager', group: 'requests' },
  { href: '/requests', label: 'navWarehouseQueue', icon: PackageCheck, roles: ['WAREHOUSE_KEEPER'], badge: 'warehouse', group: 'requests' },
  { href: '/requests', label: 'navRequests', icon: ClipboardList, roles: ['ADMIN'], group: 'requests' },
  { href: '/requests/new', label: 'navNewRequest', icon: PlusCircle, group: 'requests' },
  { href: '/inventory', label: 'navInventory', icon: Boxes, roles: ['WAREHOUSE_KEEPER'], group: 'stock' },
  { href: '/invoices', label: 'navInvoices', icon: Receipt, roles: ['WAREHOUSE_KEEPER'], group: 'stock' },
  { href: '/supplies', label: 'navSupply', icon: PackagePlus, roles: ['WAREHOUSE_KEEPER'], group: 'stock' },
  { href: '/custody', label: 'navCustody', icon: ClipboardSignature, roles: ['WAREHOUSE_KEEPER'], group: 'stock' },
  { href: '/purchase-requests', label: 'navPurchase', icon: ShoppingCart, roles: ['WAREHOUSE_KEEPER'], group: 'stock' },
  { href: '/reports', label: 'navReports', icon: BarChart3, roles: ['WAREHOUSE_KEEPER', 'DEPT_MANAGER'], group: 'insight' },
  { href: '/setup', label: 'navSetup', icon: Settings2, roles: ['ADMIN'], group: 'admin' },
  { href: '/admin', label: 'navAdmin', icon: Users, roles: ['ADMIN'], group: 'admin' },
];

/** المرحلة التي تنتظر إجراء من كل دور (تغذي الجرس). */
const ACTION: Partial<Record<Role, { stage: string; key: 'pendingManager' | 'pendingWarehouse' | 'needsEdit' }>> = {
  EMPLOYEE: { stage: 'edit', key: 'needsEdit' },
  DEPT_MANAGER: { stage: 'manager', key: 'pendingManager' },
  BRANCH_MANAGER: { stage: 'manager', key: 'pendingManager' },
  WAREHOUSE_KEEPER: { stage: 'warehouse', key: 'pendingWarehouse' },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // «من نحن» صفحة عامة: تُفتح من شاشة الدخول دون تسجيل
  const publicPage = pathname === '/about';
  useEffect(() => { if (ready && !user && !publicPage) router.replace('/login'); }, [ready, user, publicPage, router]);
  useEffect(() => setOpen(false), [pathname]);

  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), enabled: !!user, refetchInterval: 30_000 });

  if (!ready) return <Spinner />;
  if (!user && publicPage) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex justify-end">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-accent-soft ring-1 ring-inset ring-accent/40 hover:bg-accent/10">{t('signIn')}</Link>
        </div>
        {children}
      </div>
    );
  }
  if (!user) return <Spinner />;

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
          <Link href="/about" className={cn(iconBtn, pathname === '/about' && 'bg-accent/25 text-accent-soft')} aria-label={t('navAbout')} title={t('navAbout')}><Info className="size-5" /></Link>
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
          <nav aria-label="main" className="flex flex-col gap-4">
            {GROUPS.map((g) => {
              const list = items.filter((n) => n.group === g.id);
              if (!list.length) return null;
              return (
                <div key={g.id} role="group" aria-label={g.label ? t(g.label) : undefined} className="flex flex-col gap-1.5">
                  {g.label && <p className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted/80">{t(g.label)}</p>}
                  {list.map((n) => {
                    const active = n.href === activeHref;
                    const count = badgeValue(n.badge);
                    return (
                      <Link
                        key={n.href + n.label}
                        href={n.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium',
                          active ? 'nav-active' : 'text-fg/80 hover:bg-white/10 hover:text-fg',
                        )}
                      >
                        <n.icon className="size-[18px] shrink-0" aria-hidden />
                        <span className="flex-1">{t(n.label)}</span>
                        {count > 0 && (
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', active ? 'bg-white/25 text-white' : 'bg-accent/20 text-accent-soft')}>{count}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="mt-4 min-w-0 lg:mt-0">{children}</main>
      </div>
    </div>
  );
}
