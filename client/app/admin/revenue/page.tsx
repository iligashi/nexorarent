'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import StatCard from '@/components/admin/StatCard';
import { DollarSign, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { useLanguageStore } from '@/stores/languageStore';

interface RevenueData {
  overview: { month: string; revenue: string; bookings: string; avg_days: string }[];
  by_category: { category: string; revenue: string; bookings: string }[];
  top_cars: { brand: string; model: string; revenue: string; bookings: string }[];
}

export default function AdminRevenuePage() {
  const { t } = useLanguageStore();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('12m');

  const periods = [
    { label: t.days7, value: '7d' },
    { label: t.days30, value: '30d' },
    { label: t.days90, value: '90d' },
    { label: t.months12, value: '12m' },
  ];

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/admin/revenue?period=${period}`);
        setData(data);
      } catch (err) {
        console.error('Failed to fetch revenue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRevenue();
  }, [period]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.revenue}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl p-6 animate-pulse"><div className="h-4 w-20 bg-gray-100 rounded mb-2" /><div className="h-8 w-28 bg-gray-100 rounded" /></div>)}
        </div>
      </div>
    );
  }

  const totalRevenue = data.overview.reduce((sum, r) => sum + Number(r.revenue), 0);
  const totalBookings = data.overview.reduce((sum, r) => sum + Number(r.bookings), 0);
  const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
  const avgDays = data.overview.length > 0
    ? data.overview.reduce((sum, r) => sum + Number(r.avg_days || 0), 0) / data.overview.length
    : 0;

  const lineData = data.overview.map(item => ({
    month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    revenue: Number(item.revenue),
    bookings: Number(item.bookings),
  }));

  const barData = data.by_category.map(item => ({
    category: item.category.charAt(0).toUpperCase() + item.category.slice(1),
    revenue: Number(item.revenue),
    bookings: Number(item.bookings),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.revenue}</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${period === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t.totalRevenue} value={formatPrice(totalRevenue)} icon={DollarSign} color="#22C55E" />
        <StatCard label={t.totalBookings} value={String(totalBookings)} icon={Calendar} color="#3B82F6" />
        <StatCard label={t.avgBookingValue} value={formatPrice(avgBookingValue)} icon={TrendingUp} color="#FF4D30" />
        <StatCard label={t.avgRentalDays} value={avgDays.toFixed(1)} icon={BarChart3} color="#8B5CF6" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.revenueOverTime}</h2>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={v => `€${v}`} />
                <Tooltip formatter={(v: number, name: string) => [name === 'revenue' ? `€${v}` : v, name === 'revenue' ? 'Revenue' : 'Bookings']} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#FF4D30" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="bookings" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">{t.noDataPeriod}</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.revenueByCategory}</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={v => `€${v}`} />
                <Tooltip formatter={(v: number) => [`€${v}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#FF4D30" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">{t.noDataPeriod}</div>
          )}
        </div>
      </div>

      {/* Top cars table */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.topPerformingCars}</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-4">#</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-4">{t.car}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-4">{t.bookings}</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-4">{t.revenue}</th>
              </tr>
            </thead>
            <tbody>
              {data.top_cars.map((car, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-500">{i + 1}</td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{car.brand} {car.model}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{car.bookings}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">{formatPrice(Number(car.revenue))}</td>
                </tr>
              ))}
              {data.top_cars.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400">{t.noDataAvailable}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
