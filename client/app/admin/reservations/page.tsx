'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import AdminBadge from '@/components/admin/AdminBadge';
import { Search, Calendar, X } from 'lucide-react';
import type { Reservation, ReservationStatus } from '@/types';

const statusTabs: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const { data } = await api.get(`/admin/reservations?${params}`);
      setReservations(data.reservations);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReservations(); }, [statusFilter, search, page]);

  const updateStatus = async (id: string, status: ReservationStatus, adminNotes?: string) => {
    setUpdatingStatus(true);
    try {
      await api.put(`/admin/reservations/${id}/status`, { status, admin_notes: adminNotes });
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      if (selectedRes?.id === id) setSelectedRes(prev => prev ? { ...prev, status } : null);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const columns = [
    {
      key: 'reservation_no', label: '#',
      render: (r: Reservation) => <span className="font-mono text-xs font-medium text-gray-900">{r.reservation_no}</span>,
    },
    {
      key: 'customer', label: 'Customer',
      render: (r: Reservation) => (
        <div>
          <p className="font-medium text-gray-900">{r.customer_name || r.guest_name || 'N/A'}</p>
          <p className="text-xs text-gray-500">{r.customer_phone || r.guest_phone || ''}</p>
        </div>
      ),
    },
    {
      key: 'car', label: 'Car',
      render: (r: Reservation) => <span className="text-sm">{r.brand} {r.model}</span>,
    },
    {
      key: 'dates', label: 'Dates',
      render: (r: Reservation) => (
        <div className="text-xs">
          <p>{formatDate(r.pickup_date)}</p>
          <p className="text-gray-400">to {formatDate(r.dropoff_date)}</p>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (r: Reservation) => <AdminBadge status={r.status} />,
    },
    {
      key: 'total_price', label: 'Amount',
      render: (r: Reservation) => <span className="font-semibold text-gray-900">{formatPrice(r.total_price)}</span>,
    },
    {
      key: 'actions', label: '',
      render: (r: Reservation) => (
        <button onClick={(e) => { e.stopPropagation(); setSelectedRes(r); }} className="text-[#FF4D30] hover:underline text-sm font-medium">
          View
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">Reservations</h1>
        <Link href="/admin/reservations/calendar" className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          <Calendar className="w-4 h-4" /> Calendar View
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by reservation #, customer name..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
        />
      </div>

      <DataTable
        columns={columns as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]}
        data={reservations as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No reservations found"
        onRowClick={(r) => setSelectedRes(r as unknown as Reservation)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedRes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRes(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Reservation {selectedRes.reservation_no}</h2>
              <button onClick={() => setSelectedRes(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <AdminBadge status={selectedRes.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{selectedRes.customer_name || selectedRes.guest_name}</p>
                  <p className="text-gray-500">{selectedRes.customer_email || selectedRes.guest_email}</p>
                  <p className="text-gray-500">{selectedRes.customer_phone || selectedRes.guest_phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Car</p>
                  <p className="font-medium text-gray-900">{selectedRes.brand} {selectedRes.model}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pickup</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedRes.pickup_date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Dropoff</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedRes.dropoff_date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="font-medium text-gray-900">{selectedRes.total_days} days</p>
                </div>
                <div>
                  <p className="text-gray-500">Daily Rate</p>
                  <p className="font-medium text-gray-900">{formatPrice(selectedRes.daily_rate)}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal ({selectedRes.total_days} days)</span>
                  <span>{formatPrice(selectedRes.daily_rate * selectedRes.total_days)}</span>
                </div>
                {selectedRes.extras_total > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Extras</span>
                    <span>{formatPrice(selectedRes.extras_total)}</span>
                  </div>
                )}
                {selectedRes.discount > 0 && (
                  <div className="flex justify-between text-sm mt-1 text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(selectedRes.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold mt-3 pt-3 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-[#FF4D30]">{formatPrice(selectedRes.total_price)}</span>
                </div>
              </div>
              {selectedRes.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Customer Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedRes.notes}</p>
                </div>
              )}
              {/* Status actions */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRes.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(selectedRes.id, 'confirmed')} disabled={updatingStatus} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50">Confirm</button>
                      <button onClick={() => updateStatus(selectedRes.id, 'rejected')} disabled={updatingStatus} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50">Reject</button>
                    </>
                  )}
                  {selectedRes.status === 'confirmed' && (
                    <>
                      <button onClick={() => updateStatus(selectedRes.id, 'active')} disabled={updatingStatus} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50">Mark Active</button>
                      <button onClick={() => updateStatus(selectedRes.id, 'cancelled')} disabled={updatingStatus} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50">Cancel</button>
                    </>
                  )}
                  {selectedRes.status === 'active' && (
                    <button onClick={() => updateStatus(selectedRes.id, 'completed')} disabled={updatingStatus} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">Mark Completed</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
