'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import CarForm from '@/components/admin/CarForm';
import { useLanguageStore } from '@/stores/languageStore';

export default function NewCarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguageStore();

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/cars', formData);
      router.push('/admin/cars');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create car';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.addNewCarTitle}</h1>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <CarForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
