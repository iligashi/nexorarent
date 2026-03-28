'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, Car, CalendarDays, Users, TrendingUp,
  FileText, Mail, Settings, ChevronLeft, ChevronRight,
  Bell, LogOut, Menu, Star, Wrench, DollarSign, Award,
  MessageSquare, Truck, Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguageStore } from '@/stores/languageStore';

const navItemDefs = [
  { href: '/admin', icon: LayoutDashboard, labelKey: 'adminDashboardLabel' as const },
  { href: '/admin/cars', icon: Car, labelKey: 'adminCarsLabel' as const },
  { href: '/admin/reservations', icon: CalendarDays, labelKey: 'adminReservationsLabel' as const },
  { href: '/admin/customers', icon: Users, labelKey: 'adminCustomersLabel' as const },
  { href: '/admin/revenue', icon: TrendingUp, labelKey: 'adminRevenueLabel' as const },
  { href: '/admin/reviews', icon: Star, labelKey: 'adminReviewsLabel' as const },
  { href: '/admin/expenses', icon: DollarSign, labelKey: 'adminExpensesLabel' as const },
  { href: '/admin/maintenance', icon: Wrench, labelKey: 'adminMaintenanceLabel' as const },
  { href: '/admin/pricing', icon: Gauge, labelKey: 'adminPricingLabel' as const },
  { href: '/admin/loyalty', icon: Award, labelKey: 'adminLoyaltyLabel' as const },
  { href: '/admin/notifications', icon: MessageSquare, labelKey: 'adminNotificationsLabel' as const },
  { href: '/admin/deliveries', icon: Truck, labelKey: 'adminDeliveriesLabel' as const },
  { href: '/admin/blog', icon: FileText, labelKey: 'adminBlogLabel' as const },
  { href: '/admin/messages', icon: Mail, labelKey: 'adminMessagesLabel' as const },
  { href: '/admin/settings', icon: Settings, labelKey: 'adminSettingsLabel' as const },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, fetchUser, logout } = useAuthStore();
  const { t } = useLanguageStore();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && (!user || !['staff', 'manager', 'owner'].includes(user.role))) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF4D30] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !['staff', 'manager', 'owner'].includes(user.role)) return null;

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const breadcrumbs = pathname.split('/').filter(Boolean).map((seg, i, arr) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + arr.slice(0, i + 1).join('/'),
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 transition-all duration-300 flex flex-col',
        collapsed ? 'w-[70px]' : 'w-[260px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          {!collapsed && (
            <Link href="/admin" className="font-outfit font-bold text-xl text-gray-900">
              Nexora<span className="text-[#FF4D30]">Admin</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/admin" className="font-outfit font-bold text-xl text-[#FF4D30] mx-auto">N</Link>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItemDefs.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-[#FF4D30] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{t[item.labelKey]}</span>}
            </Link>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-gray-100 hidden lg:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>{t.collapse}</span></>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('flex-1 transition-all duration-300', collapsed ? 'lg:ml-[70px]' : 'lg:ml-[260px]')}>
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-600">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              {breadcrumbs.map((b, i) => (
                <span key={b.href} className="flex items-center gap-2">
                  {i > 0 && <span>/</span>}
                  <Link href={b.href} className={cn(i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : 'hover:text-gray-700')}>
                    {b.label}
                  </Link>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF4D30] rounded-full" />
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FF4D30] flex items-center justify-center text-white text-sm font-semibold">
                {user.first_name[0]}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <button onClick={() => { logout(); router.push('/auth/login'); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title={t.logout}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
