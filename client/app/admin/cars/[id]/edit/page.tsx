'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import CarForm from '@/components/admin/CarForm';
import type { Car } from '@/types';

export default function EditCarPage() {
  const { id } = useParams();
  const router = useRouter();
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCar = async () => {
      try {
        // First get the car slug from the list, then fetch full detail with images
        const { data: listData } = await api.get(`/cars?limit=100`);
        const found = listData.cars.find((c: Car) => c.id === id);
        if (!found) { setError('Car not found'); return; }
        // Fetch full detail including images
        const { data } = await api.get(`/cars/${found.slug}`);
        setCar(data.car);
      } catch {
        setError('Failed to load car');
      } finally {
        setFetching(false);
      }
    };
    fetchCar();
  }, [id]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      await api.put(`/admin/cars/${id}`, formData);
      router.push('/admin/cars');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update car';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="bg-white rounded-xl p-6 space-y-4 animate-pulse">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">Edit Car</h1>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {car && <CarForm car={car} onSubmit={handleSubmit} loading={loading} />}
    </div>
  );
}
