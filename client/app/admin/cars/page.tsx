'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import AdminBadge from '@/components/admin/AdminBadge';
import { Plus, Search } from 'lucide-react';
import type { Car } from '@/types';

export default function AdminCarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchCars = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      params.set('limit', '100');
      const { data } = await api.get(`/cars?${params}`);
      setCars(data.cars);
    } catch (err) {
      console.error('Failed to fetch cars:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCars(); }, [search, categoryFilter]);

  const toggleAvailability = async (id: string) => {
    try {
      await api.patch(`/admin/cars/${id}/toggle`);
      setCars(prev => prev.map(c => c.id === id ? { ...c, is_available: !c.is_available } : c));
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const columns = [
    {
      key: 'image', label: 'Image', className: 'w-16',
      render: (car: Car) => (
        <div className="w-14 h-10 rounded bg-gray-100 overflow-hidden">
          {car.image ? (
            <img src={car.image.startsWith('http') ? car.image : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}${car.image}`} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No img</div>
          )}
        </div>
      ),
    },
    {
      key: 'name', label: 'Brand / Model',
      render: (car: Car) => (
        <div>
          <p className="font-medium text-gray-900">{car.brand} {car.model}</p>
          <p className="text-xs text-gray-500">{car.year} · {car.color}</p>
        </div>
      ),
    },
    {
      key: 'category', label: 'Category',
      render: (car: Car) => <span className="capitalize text-sm">{car.category}</span>,
    },
    {
      key: 'price_per_day', label: 'Price/Day',
      render: (car: Car) => <span className="font-semibold text-gray-900">{formatPrice(car.price_per_day)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (car: Car) => (
        <button onClick={(e) => { e.stopPropagation(); toggleAvailability(car.id); }}>
          <AdminBadge status={car.is_available ? 'active' : 'cancelled'} className="cursor-pointer" />
        </button>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      render: (car: Car) => (
        <Link href={`/admin/cars/${car.id}/edit`} onClick={e => e.stopPropagation()} className="text-[#FF4D30] hover:underline text-sm font-medium">
          Edit
        </Link>
      ),
    },
  ];

  const categories = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'sports'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">Cars</h1>
        <Link href="/admin/cars/new" className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors">
          <Plus className="w-4 h-4" /> Add New Car
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search cars..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={cars as unknown as Record<string, unknown>[]} loading={loading} emptyMessage="No cars found" />
    </div>
  );
}
