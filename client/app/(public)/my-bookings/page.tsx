'use client';

import { useEffect, useState } from 'react';
import { Calendar, Car } from 'lucide-react';
import api from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatPrice, formatDate } from '@/lib/utils';
import type { Reservation } from '@/types';

export default function MyBookingsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reservations/mine')
      .then(r => setReservations(r.data.reservations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await api.put(`/reservations/${id}/cancel`);
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
    } catch {}
  };

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-outfit font-bold text-3xl text-white mb-8">My Bookings</h1>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-secondary border border-border rounded-xl p-6 animate-pulse h-32" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-20 bg-bg-secondary border border-border rounded-xl">
            <Car className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted text-lg">No reservations yet</p>
            <a href="/cars" className="text-accent text-sm mt-2 inline-block hover:underline">Browse our fleet</a>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map(r => (
              <div key={r.id} className="bg-bg-secondary border border-border rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-outfit font-bold text-white">{r.reservation_no}</span>
                      <Badge status={r.status} />
                    </div>
                    <p className="text-white font-medium">{r.brand} {r.model}</p>
                    <div className="flex items-center gap-4 text-text-secondary text-sm mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(r.pickup_date)} - {formatDate(r.dropoff_date)}</span>
                      <span>{r.total_days} day{r.total_days !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-outfit font-bold text-accent text-xl">{formatPrice(Number(r.total_price))}</span>
                    {['pending', 'confirmed'].includes(r.status) && (
                      <Button variant="ghost" size="sm" onClick={() => handleCancel(r.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
