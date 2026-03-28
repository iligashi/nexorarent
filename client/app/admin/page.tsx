'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import StatCard from '@/components/admin/StatCard';
import DataTable from '@/components/admin/DataTable';
import AdminBadge from '@/components/admin/AdminBadge';
import { DollarSign, CalendarDays, Car, Users } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useLanguageStore } from '@/stores/languageStore';

interface DashboardData {
  revenue_this_month: number;
  active_reservations: number;
  available_cars: number;
  new_customers: number;
  revenue_chart: { month: string; revenue: number; bookings: number }[];
  status_distribution: { status: string; count: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  active: '#22C55E',
  completed: '#6B7280',
  cancelled: '#EF4444',
  rejected: '#DC2626',
};

export default function AdminDashboard() {
  const { t } = useLanguageStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentReservations, setRecentReservations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, resRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/reservations?limit=10'),
        ]);
        setData(dashRes.data);
        setRecentReservations(resRes.data.reservations);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.adminDashboardLabel}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
              <div className="h-8 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const revenueChart = data.revenue_chart.map(item => ({
    month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    revenue: Number(item.revenue),
    bookings: Number(item.bookings),
  }));

  const pieData = data.status_distribution
    .filter(s => Number(s.count) > 0)
    .map(s => ({ name: s.status, value: Number(s.count) }));

  const reservationColumns = [
    { key: 'reservation_no', label: '#', render: (r: Record<string, unknown>) => (
      <span className="font-mono text-xs font-medium text-gray-900">{String(r.reservation_no)}</span>
    )},
    { key: 'customer_name', label: t.customer, render: (r: Record<string, unknown>) => (
      <div>
        <p className="font-medium text-gray-900">{String(r.customer_name || 'N/A')}</p>
        <p className="text-xs text-gray-500">{String(r.customer_phone || '')}</p>
      </div>
    )},
    { key: 'car', label: t.car, render: (r: Record<string, unknown>) => `${r.brand} ${r.model}` },
    { key: 'pickup_date', label: t.dates, render: (r: Record<string, unknown>) => (
      <div className="text-xs">
        <p>{formatDate(String(r.pickup_date))}</p>
        <p className="text-gray-400">{t.to} {formatDate(String(r.dropoff_date))}</p>
      </div>
    )},
    { key: 'status', label: t.status, render: (r: Record<string, unknown>) => <AdminBadge status={String(r.status)} /> },
    { key: 'total_price', label: t.amount, render: (r: Record<string, unknown>) => (
      <span className="font-semibold text-gray-900">{formatPrice(Number(r.total_price))}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.adminDashboardLabel}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t.revenueThisMonth} value={formatPrice(data.revenue_this_month)} icon={DollarSign} color="#22C55E" />
        <StatCard label={t.activeReservations} value={String(data.active_reservations)} icon={CalendarDays} color="#3B82F6" />
        <StatCard label={t.availableCarsLabel} value={String(data.available_cars)} icon={Car} color="#FF4D30" />
        <StatCard label={t.newCustomers} value={String(data.new_customers)} icon={Users} color="#8B5CF6" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.revenueOverview}</h2>
          {revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={v => `€${v}`} />
                <Tooltip formatter={(v: number) => [`€${v}`, t.revenue]} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB' }} />
                <Line type="monotone" dataKey="revenue" stroke="#FF4D30" strokeWidth={2.5} dot={{ fill: '#FF4D30', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">{t.noRevenueData}</div>
          )}
        </div>

        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.bookingStatus}</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || '#9CA3AF'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={v => <span className="text-xs capitalize">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">{t.noBookingsYet}</div>
          )}
        </div>
      </div>

      {/* Recent reservations */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.recentReservations}</h2>
        <DataTable columns={reservationColumns} data={recentReservations} loading={false} emptyMessage={t.noReservationsYetAdmin} />
      </div>
    </div>
  );
}
