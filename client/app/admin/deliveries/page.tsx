'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguageStore } from '@/stores/languageStore';
import api from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import { Truck, Plus, MapPin, Phone, Clock, Check, ChevronDown, Eye, Navigation, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeliveryAssignment {
  id: string;
  reservation_id: string;
  driver_id: string;
  type: 'delivery' | 'return_pickup';
  status: 'assigned' | 'en_route' | 'arrived' | 'completed' | 'cancelled';
  destination_address: string;
  destination_lat?: number;
  destination_lng?: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  driver_name: string;
  driver_phone: string;
  reservation_no: string;
  customer_name: string;
  customer_phone: string;
  car_name: string;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

interface LocationEntry {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  created_at: string;
}

// ── WhatsApp helpers ───────────────────────────────────────────────────────────

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function formatPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
}

// ── Constants ──────────────────────────────────────────────────────────────────

const statusBadgeStyles: Record<string, string> = {
  assigned: 'bg-gray-100 text-gray-700',
  en_route: 'bg-blue-100 text-blue-700',
  arrived: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const typeBadgeStyles: Record<string, string> = {
  delivery: 'bg-blue-100 text-blue-700',
  return_pickup: 'bg-purple-100 text-purple-700',
};

/** Returns the list of statuses a delivery can transition to from its current status. */
function getNextStatuses(current: string): string[] {
  switch (current) {
    case 'assigned':
      return ['en_route', 'cancelled'];
    case 'en_route':
      return ['arrived', 'cancelled'];
    case 'arrived':
      return ['completed', 'cancelled'];
    default:
      return [];
  }
}

const PAGE_LIMIT = 20;

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminDeliveriesPage() {
  const { t } = useLanguageStore();

  const statusTabs = [
    { label: t.all, value: 'all' },
    { label: t.assigned, value: 'assigned' },
    { label: t.enRoute, value: 'en_route' },
    { label: t.arrived, value: 'arrived' },
    { label: t.completed, value: 'completed' },
    { label: t.cancelled, value: 'cancelled' },
  ];

  const statusLabels: Record<string, string> = {
    assigned: t.assigned,
    en_route: t.enRoute,
    arrived: t.arrived,
    completed: t.completed,
    cancelled: t.cancelled,
  };

  const typeLabels: Record<string, string> = {
    delivery: t.delivery,
    return_pickup: t.returnPickup,
  };

  // Data
  const [deliveries, setDeliveries] = useState<DeliveryAssignment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reservations, setReservations] = useState<{ id: string; reservation_no: string; customer_name: string; car_name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters / pagination
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // UI state
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryAssignment | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationEntry[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    reservation_id: '',
    driver_id: '',
    type: 'delivery' as 'delivery' | 'return_pickup',
    destination_address: '',
    destination_lat: '',
    destination_lng: '',
    notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Fetch deliveries ─────────────────────────────────────────────────────

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(PAGE_LIMIT));
      const { data } = await api.get(`/admin/deliveries?${params}`);
      setDeliveries(data.deliveries);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  // ── Fetch drivers (once) ────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [driversRes, reservationsRes] = await Promise.all([
          api.get('/admin/deliveries/drivers'),
          api.get('/admin/deliveries/reservations'),
        ]);
        setDrivers(driversRes.data.drivers);
        setReservations(reservationsRes.data.reservations);
      } catch (err) {
        console.error('Failed to fetch drivers/reservations:', err);
      }
    })();
  }, []);

  // ── Active count ────────────────────────────────────────────────────────

  const activeCount = deliveries.filter(d =>
    ['assigned', 'en_route', 'arrived'].includes(d.status),
  ).length;

  // ── Update status ───────────────────────────────────────────────────────

  const updateStatus = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try {
      await api.put(`/admin/deliveries/${id}/status`, { status });
      setDeliveries(prev =>
        prev.map(d => (d.id === id ? { ...d, status: status as DeliveryAssignment['status'] } : d)),
      );
      if (selectedDelivery?.id === id) {
        setSelectedDelivery(prev =>
          prev ? { ...prev, status: status as DeliveryAssignment['status'] } : null,
        );
      }
      setStatusDropdownId(null);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── View detail ─────────────────────────────────────────────────────────

  const openDetail = async (delivery: DeliveryAssignment) => {
    setSelectedDelivery(delivery);
    setLocationHistory([]);
    setLoadingLocations(true);
    try {
      const { data } = await api.get(`/admin/deliveries/${delivery.id}/locations`);
      setLocationHistory(data.locations ?? data ?? []);
    } catch {
      // locations may not exist yet
    } finally {
      setLoadingLocations(false);
    }
  };

  // ── Create delivery ─────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.reservation_id || !createForm.driver_id || !createForm.destination_address) {
      setCreateError('Reservation ID, driver, and destination address are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const body: Record<string, unknown> = {
        reservation_id: createForm.reservation_id,
        driver_id: createForm.driver_id,
        type: createForm.type,
        destination_address: createForm.destination_address,
        notes: createForm.notes || undefined,
      };
      if (createForm.destination_lat) body.destination_lat = parseFloat(createForm.destination_lat);
      if (createForm.destination_lng) body.destination_lng = parseFloat(createForm.destination_lng);

      await api.post('/admin/deliveries', body);
      setShowCreateModal(false);
      setCreateForm({
        reservation_id: '',
        driver_id: '',
        type: 'delivery',
        destination_address: '',
        destination_lat: '',
        destination_lng: '',
        notes: '',
      });
      fetchDeliveries();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error: string } } }).response?.data?.error
          : 'Failed to create delivery';
      setCreateError(msg || 'Failed to create delivery');
    } finally {
      setCreating(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────

  const columns = [
    {
      key: 'reservation_no',
      label: t.reservationNum,
      render: (d: DeliveryAssignment) => (
        <span className="font-mono text-xs font-medium text-gray-900">{d.reservation_no}</span>
      ),
    },
    {
      key: 'customer',
      label: t.customer,
      render: (d: DeliveryAssignment) => (
        <div>
          <p className="font-medium text-gray-900">{d.customer_name}</p>
          {d.customer_phone && (
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-gray-500">{d.customer_phone}</p>
              <a
                href={`https://wa.me/${formatPhoneForWhatsApp(d.customer_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title={t.chatOnWhatsapp}
                className="text-green-500 hover:text-green-600 transition-colors"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'car',
      label: t.car,
      render: (d: DeliveryAssignment) => <span className="text-sm">{d.car_name}</span>,
    },
    {
      key: 'driver',
      label: t.driver,
      render: (d: DeliveryAssignment) => (
        <div>
          <p className="font-medium text-gray-900">{d.driver_name}</p>
          {d.driver_phone && (
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-gray-500">{d.driver_phone}</p>
              <a
                href={`https://wa.me/${formatPhoneForWhatsApp(d.driver_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title={t.chatOnWhatsapp}
                className="text-green-500 hover:text-green-600 transition-colors"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: t.type,
      render: (d: DeliveryAssignment) => (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            typeBadgeStyles[d.type],
          )}
        >
          {typeLabels[d.type] ?? d.type}
        </span>
      ),
    },
    {
      key: 'status',
      label: t.status,
      render: (d: DeliveryAssignment) => (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            statusBadgeStyles[d.status],
          )}
        >
          {statusLabels[d.status] ?? d.status}
        </span>
      ),
    },
    {
      key: 'destination',
      label: t.destination,
      render: (d: DeliveryAssignment) => (
        <div className="flex items-center gap-1 max-w-[200px]">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 truncate">{d.destination_address}</span>
        </div>
      ),
    },
    {
      key: 'created_at',
      label: t.created,
      render: (d: DeliveryAssignment) => (
        <span className="text-xs text-gray-500">{formatDate(d.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (d: DeliveryAssignment) => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {/* Status dropdown */}
          {getNextStatuses(d.status).length > 0 && (
            <div className="relative">
              <button
                onClick={() => setStatusDropdownId(statusDropdownId === d.id ? null : d.id)}
                disabled={updatingStatus}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t.update} <ChevronDown className="w-3 h-3" />
              </button>
              {statusDropdownId === d.id && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  {getNextStatuses(d.status).map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(d.id, s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          s === 'en_route' && 'bg-blue-500',
                          s === 'arrived' && 'bg-green-500',
                          s === 'completed' && 'bg-emerald-500',
                          s === 'cancelled' && 'bg-red-500',
                        )}
                      />
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* View details */}
          <button
            onClick={() => openDetail(d)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#FF4D30] hover:underline"
          >
            <Eye className="w-3.5 h-3.5" /> {t.view}
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FF4D30]/10 rounded-xl">
            <Truck className="w-6 h-6 text-[#FF4D30]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.deliveryTracking}</h1>
            <p className="text-sm text-gray-500">
              {activeCount} {t.activeDeliveries}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors"
        >
          <Plus className="w-4 h-4" /> {t.newDelivery}
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              statusFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={deliveries}
        loading={loading}
        emptyMessage={t.noDeliveriesFound}
        onRowClick={r => openDetail(r as unknown as DeliveryAssignment)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_LIMIT + 1}&ndash;{Math.min(page * PAGE_LIMIT, total)} of{' '}
            {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              {t.prev}
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              {t.next}
            </button>
          </div>
        </div>
      )}

      {/* ── Create delivery modal ────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{t.createDelivery}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Reservation ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.reservationIdLabel}
                </label>
                <select
                  value={createForm.reservation_id}
                  onChange={e =>
                    setCreateForm(prev => ({ ...prev, reservation_id: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  <option value="">Select a reservation</option>
                  {reservations.map(r => (
                    <option key={r.id} value={r.id}>
                      #{r.reservation_no} — {r.customer_name} ({r.car_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.driver}</label>
                <select
                  value={createForm.driver_id}
                  onChange={e => setCreateForm(prev => ({ ...prev, driver_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  <option value="">{t.selectADriver}</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.first_name} {d.last_name} &mdash; {d.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.type}</label>
                <select
                  value={createForm.type}
                  onChange={e =>
                    setCreateForm(prev => ({
                      ...prev,
                      type: e.target.value as 'delivery' | 'return_pickup',
                    }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  <option value="delivery">{t.delivery}</option>
                  <option value="return_pickup">{t.returnPickup}</option>
                </select>
              </div>

              {/* Destination address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.destinationAddress}
                </label>
                <input
                  type="text"
                  value={createForm.destination_address}
                  onChange={e =>
                    setCreateForm(prev => ({ ...prev, destination_address: e.target.value }))
                  }
                  placeholder={t.fullDeliveryAddress}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Lat / Lng (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.latitude} <span className="text-gray-400 font-normal">({t.optional})</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.destination_lat}
                    onChange={e =>
                      setCreateForm(prev => ({ ...prev, destination_lat: e.target.value }))
                    }
                    placeholder="e.g. 33.8869"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.longitude} <span className="text-gray-400 font-normal">({t.optional})</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.destination_lng}
                    onChange={e =>
                      setCreateForm(prev => ({ ...prev, destination_lng: e.target.value }))
                    }
                    placeholder="e.g. 35.5131"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.notesLabel} <span className="text-gray-400 font-normal">({t.optional})</span>
                </label>
                <textarea
                  value={createForm.notes}
                  onChange={e => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder={t.specialInstructions}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                />
              </div>

              {createError && <p className="text-red-500 text-sm">{createError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-[#FF4D30] rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
                >
                  {creating ? t.creating : t.createDelivery}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {selectedDelivery && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDelivery(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">{t.deliveryDetails}</h2>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    statusBadgeStyles[selectedDelivery.status],
                  )}
                >
                  {statusLabels[selectedDelivery.status]}
                </span>
              </div>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    typeBadgeStyles[selectedDelivery.type],
                  )}
                >
                  {typeLabels[selectedDelivery.type]}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {selectedDelivery.reservation_no}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {t.customer}
                  </p>
                  <p className="font-medium text-gray-900">{selectedDelivery.customer_name}</p>
                  {selectedDelivery.customer_phone && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gray-500">{selectedDelivery.customer_phone}</p>
                      <a
                        href={`https://wa.me/${formatPhoneForWhatsApp(selectedDelivery.customer_phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t.chatOnWhatsapp}
                        className="inline-flex items-center gap-1 text-green-500 hover:text-green-600 transition-colors"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" /> {t.driver}
                  </p>
                  <p className="font-medium text-gray-900">{selectedDelivery.driver_name}</p>
                  {selectedDelivery.driver_phone && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gray-500">{selectedDelivery.driver_phone}</p>
                      <a
                        href={`https://wa.me/${formatPhoneForWhatsApp(selectedDelivery.driver_phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t.chatOnWhatsapp}
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
                  <p className="font-medium text-gray-900">{selectedDelivery.car_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {t.destination}
                  </p>
                  <p className="font-medium text-gray-900">{selectedDelivery.destination_address}</p>
                </div>
                <div>
                  <p className="text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {t.created}
                  </p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(selectedDelivery.created_at)}
                  </p>
                </div>
                {selectedDelivery.started_at && (
                  <div>
                    <p className="text-gray-500">{t.started}</p>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(selectedDelivery.started_at)}
                    </p>
                  </div>
                )}
                {selectedDelivery.completed_at && (
                  <div>
                    <p className="text-gray-500 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {t.completed}
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(selectedDelivery.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedDelivery.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t.notesLabel}</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {selectedDelivery.notes}
                  </p>
                </div>
              )}

              {/* Location history */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Navigation className="w-4 h-4" /> {t.locationHistory}
                </p>
                {loadingLocations ? (
                  <div className="text-sm text-gray-400">{t.loadingLocationsText}</div>
                ) : locationHistory.length === 0 ? (
                  <div className="text-sm text-gray-400">{t.noLocationData}</div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {locationHistory.map((loc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-700">
                            {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                          </span>
                          {loc.speed != null && (
                            <span className="text-gray-400">{loc.speed.toFixed(0)} km/h</span>
                          )}
                        </div>
                        <span className="text-gray-400">{formatDateTime(loc.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status actions */}
              {getNextStatuses(selectedDelivery.status).length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">{t.updateStatus}</p>
                  <div className="flex flex-wrap gap-2">
                    {getNextStatuses(selectedDelivery.status).map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedDelivery.id, s)}
                        disabled={updatingStatus}
                        className={cn(
                          'px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition-colors',
                          s === 'en_route' && 'bg-blue-500 hover:bg-blue-600',
                          s === 'arrived' && 'bg-green-500 hover:bg-green-600',
                          s === 'completed' && 'bg-emerald-500 hover:bg-emerald-600',
                          s === 'cancelled' && 'bg-red-500 hover:bg-red-600',
                        )}
                      >
                        {statusLabels[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Close status dropdowns when clicking outside */}
      {statusDropdownId && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownId(null)} />
      )}
    </div>
  );
}
