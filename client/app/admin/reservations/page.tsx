'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import AdminBadge from '@/components/admin/AdminBadge';
import { Search, Calendar, X, Plus, FileText, CalendarPlus } from 'lucide-react';
import type { Reservation, ReservationStatus } from '@/types';
import { useLanguageStore } from '@/stores/languageStore';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function formatPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
}

export default function AdminReservationsPage() {
  const { t } = useLanguageStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [extendDays, setExtendDays] = useState('');
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState('');

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

  const handleExtend = async () => {
    if (!selectedRes) return;
    const days = parseInt(extendDays);
    if (!days || days < 1 || days > 365) {
      setExtendError('Enter a valid number (1–365)');
      return;
    }
    setExtending(true);
    setExtendError('');
    try {
      const { data } = await api.put(`/admin/reservations/${selectedRes.id}/extend`, { extra_days: days });
      const updated = data.reservation;
      setReservations(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
      setSelectedRes(prev => prev ? { ...prev, ...updated } : null);
      setExtendDays('');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response: { data: { error: string } } }).response?.data?.error
        : 'Failed to extend reservation';
      setExtendError(msg || 'Failed to extend reservation');
    } finally {
      setExtending(false);
    }
  };

  const statusTabs: { label: string; value: string }[] = [
    { label: t.all, value: 'all' },
    { label: t.pending, value: 'pending' },
    { label: t.confirmed, value: 'confirmed' },
    { label: t.active, value: 'active' },
    { label: t.completed, value: 'completed' },
    { label: t.cancelled, value: 'cancelled' },
  ];

  const columns = [
    {
      key: 'reservation_no', label: '#',
      render: (r: Reservation) => <span className="font-mono text-xs font-medium text-gray-900">{r.reservation_no}</span>,
    },
    {
      key: 'customer', label: t.customer,
      render: (r: Reservation) => {
        const phone = r.customer_phone || r.guest_phone || '';
        return (
          <div>
            <p className="font-medium text-gray-900">{r.customer_name || r.guest_name || 'N/A'}</p>
            {phone && (
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-500">{phone}</p>
                <a
                  href={`https://wa.me/${formatPhoneForWhatsApp(phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title="Chat on WhatsApp"
                  className="text-green-500 hover:text-green-600 transition-colors"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'car', label: t.car,
      render: (r: Reservation) => <span className="text-sm">{r.brand} {r.model}</span>,
    },
    {
      key: 'dates', label: t.dates,
      render: (r: Reservation) => (
        <div className="text-xs">
          <p>{formatDate(r.pickup_date)}</p>
          <p className="text-gray-400">{t.to} {formatDate(r.dropoff_date)}</p>
        </div>
      ),
    },
    {
      key: 'status', label: t.status,
      render: (r: Reservation) => <AdminBadge status={r.status} />,
    },
    {
      key: 'total_price', label: t.amount,
      render: (r: Reservation) => <span className="font-semibold text-gray-900">{formatPrice(r.total_price)}</span>,
    },
    {
      key: 'actions', label: '',
      render: (r: Reservation) => (
        <button onClick={(e) => { e.stopPropagation(); setSelectedRes(r); }} className="text-[#FF4D30] hover:underline text-sm font-medium">
          {t.view}
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.adminReservationsLabel}</h1>
        <div className="flex gap-3">
          <Link href="/admin/reservations/new" className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors">
            <Plus className="w-4 h-4" /> {t.newReservation}
          </Link>
          <Link href="/admin/reservations/calendar" className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Calendar className="w-4 h-4" /> {t.calendarView}
          </Link>
        </div>
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
          placeholder={t.searchReservationsPlaceholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
        />
      </div>

      <DataTable
        columns={columns as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]}
        data={reservations as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage={t.noReservationsFound}
        onRowClick={(r) => setSelectedRes(r as unknown as Reservation)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">{t.prev}</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">{t.next}</button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedRes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRes(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{t.reservation} {selectedRes.reservation_no}</h2>
              <button onClick={() => setSelectedRes(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t.status}</span>
                <AdminBadge status={selectedRes.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{t.customer}</p>
                  <p className="font-medium text-gray-900">{selectedRes.customer_name || selectedRes.guest_name}</p>
                  <p className="text-gray-500">{selectedRes.customer_email || selectedRes.guest_email}</p>
                  {(selectedRes.customer_phone || selectedRes.guest_phone) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gray-500">{selectedRes.customer_phone || selectedRes.guest_phone}</p>
                      <a
                        href={`https://wa.me/${formatPhoneForWhatsApp(selectedRes.customer_phone || selectedRes.guest_phone || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Chat on WhatsApp"
                        className="inline-flex items-center gap-1 text-green-500 hover:text-green-600 transition-colors"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">{t.car}</p>
                  <p className="font-medium text-gray-900">{selectedRes.brand} {selectedRes.model}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.pickup}</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedRes.pickup_date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.dropoffLocation}</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedRes.dropoff_date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.duration}</p>
                  <p className="font-medium text-gray-900">{selectedRes.total_days} {t.days}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.dailyRate}</p>
                  <p className="font-medium text-gray-900">{formatPrice(selectedRes.daily_rate)}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.subtotal} ({selectedRes.total_days} {t.days})</span>
                  <span>{formatPrice(selectedRes.daily_rate * selectedRes.total_days)}</span>
                </div>
                {selectedRes.extras_total > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">{t.extras}</span>
                    <span>{formatPrice(selectedRes.extras_total)}</span>
                  </div>
                )}
                {selectedRes.discount > 0 && (
                  <div className="flex justify-between text-sm mt-1 text-green-600">
                    <span>{t.discount}</span>
                    <span>-{formatPrice(selectedRes.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold mt-3 pt-3 border-t border-gray-100">
                  <span>{t.total}</span>
                  <span className="text-[#FF4D30]">{formatPrice(selectedRes.total_price)}</span>
                </div>
              </div>
              {selectedRes.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t.customerNotes}</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedRes.notes}</p>
                </div>
              )}
              {/* Invoice download */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={async () => {
                    try {
                      const response = await api.get(`/admin/reservations/${selectedRes.id}/invoice`, { responseType: 'blob' });
                      const blob = new Blob([response.data], { type: 'application/pdf' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    } catch { alert('Failed to generate invoice'); }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <FileText className="w-4 h-4" /> {t.downloadInvoice}
                </button>
              </div>

              {/* Extend reservation */}
              {!['completed', 'cancelled', 'rejected'].includes(selectedRes.status) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <CalendarPlus className="w-4 h-4" /> {t.extendReservation}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={extendDays}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || (/^\d+$/.test(val) && parseInt(val) >= 0 && parseInt(val) <= 365)) {
                          setExtendDays(val);
                          setExtendError('');
                        }
                      }}
                      onKeyDown={e => {
                        if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
                      }}
                      placeholder={t.daysToAdd}
                      className="w-32 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={handleExtend}
                      disabled={extending || !extendDays}
                      className="px-4 py-2 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
                    >
                      {extending ? t.extending : t.addDays}
                    </button>
                  </div>
                  {extendError && <p className="text-red-500 text-xs mt-1">{extendError}</p>}
                  {extendDays && parseInt(extendDays) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t.newTotal} {selectedRes.total_days + parseInt(extendDays)} {t.days} (+{formatPrice(parseFloat(String(selectedRes.daily_rate)) * parseInt(extendDays))})
                    </p>
                  )}
                </div>
              )}

              {/* Status actions */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">{t.updateStatus}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRes.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(selectedRes.id, 'confirmed')} disabled={updatingStatus} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50">{t.confirm}</button>
                      <button onClick={() => updateStatus(selectedRes.id, 'rejected')} disabled={updatingStatus} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50">{t.reject}</button>
                    </>
                  )}
                  {selectedRes.status === 'confirmed' && (
                    <>
                      <button onClick={() => updateStatus(selectedRes.id, 'active')} disabled={updatingStatus} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50">{t.markActive}</button>
                      <button onClick={() => updateStatus(selectedRes.id, 'cancelled')} disabled={updatingStatus} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50">{t.cancel}</button>
                    </>
                  )}
                  {selectedRes.status === 'active' && (
                    <button onClick={() => updateStatus(selectedRes.id, 'completed')} disabled={updatingStatus} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">{t.markCompleted}</button>
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
