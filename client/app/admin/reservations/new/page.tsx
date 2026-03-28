'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useLanguageStore } from '@/stores/languageStore';
import type { Car, Location, Extra } from '@/types';

interface SelectedExtra {
  extra_id: string;
  quantity: number;
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true; // optional field
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?\d{8,15}$/.test(cleaned);
}

export default function AdminNewReservationPage() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const [cars, setCars] = useState<Car[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const [form, setForm] = useState({
    car_id: '',
    pickup_location: '',
    dropoff_location: '',
    pickup_date: '',
    pickup_time: '09:00',
    dropoff_date: '',
    dropoff_time: '09:00',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    notes: '',
    admin_notes: '',
    status: 'confirmed',
  });
  const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/cars', { params: { limit: 100 } }),
      api.get('/locations'),
      api.get('/extras'),
    ]).then(([carsRes, locsRes, extrasRes]) => {
      setCars(carsRes.data.cars);
      setLocations(locsRes.data.locations);
      setExtras(extrasRes.data.extras);
    }).catch(() => {});
  }, []);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleExtra = (extraId: string) => {
    setSelectedExtras(prev =>
      prev.some(e => e.extra_id === extraId)
        ? prev.filter(e => e.extra_id !== extraId)
        : [...prev, { extra_id: extraId, quantity: 1 }]
    );
  };

  const selectedCar = cars.find(c => c.id === form.car_id);
  const totalDays = form.pickup_date && form.dropoff_date
    ? Math.max(1, Math.ceil((new Date(form.dropoff_date).getTime() - new Date(form.pickup_date).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const basePrice = selectedCar ? Number(selectedCar.price_per_day) * totalDays : 0;
  const extrasPrice = selectedExtras.reduce((sum, se) => {
    const ext = extras.find(e => e.id === se.extra_id);
    return sum + (ext ? Number(ext.price_per_day) * totalDays * se.quantity : 0);
  }, 0);
  const totalPrice = basePrice + extrasPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.car_id || !form.pickup_location || !form.dropoff_location || !form.pickup_date || !form.dropoff_date || !form.customer_name) {
      setError(t.fillRequiredFields);
      return;
    }
    if (form.customer_phone && !isValidPhone(form.customer_phone)) {
      setPhoneError('Enter a valid phone number (e.g. +383 44 123 456)');
      setError(t.fixPhoneNumber);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        car_id: form.car_id,
        pickup_location: form.pickup_location,
        dropoff_location: form.dropoff_location,
        pickup_date: `${form.pickup_date}T${form.pickup_time}:00`,
        dropoff_date: `${form.dropoff_date}T${form.dropoff_time}:00`,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        notes: form.notes,
        admin_notes: form.admin_notes,
        status: form.status,
        extras: selectedExtras,
      };
      const { data } = await api.post('/admin/reservations', payload);
      // Generate and open the PDF invoice
      try {
        const pdfResponse = await api.get(`/admin/reservations/${data.reservation.id}/invoice`, { responseType: 'blob' });
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch { /* invoice generation is best-effort */ }
      router.push('/admin/reservations');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create reservation';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.newReservationTitle}</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Details */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.customerDetails}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t.fullName} *</label>
              <input className={inputClass} value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="John Doe" required />
            </div>
            <div>
              <label className={labelClass}>{t.email}</label>
              <input type="email" className={inputClass} value={form.customer_email} onChange={e => update('customer_email', e.target.value)} placeholder="john@example.com" />
            </div>
            <div>
              <label className={labelClass}>{t.phone}</label>
              <input
                type="tel"
                className={`${inputClass} ${phoneError ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
                value={form.customer_phone}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^[+\d\s\-()]*$/.test(val)) {
                    update('customer_phone', val);
                    setPhoneError('');
                  }
                }}
                onBlur={() => {
                  if (form.customer_phone && !isValidPhone(form.customer_phone)) {
                    setPhoneError('Enter a valid phone number (e.g. +383 44 123 456)');
                  } else {
                    setPhoneError('');
                  }
                }}
                placeholder="+383 44 123 456"
              />
              {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>
          </div>
        </div>

        {/* Car Selection */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.vehicleLabel} *</h2>
          <select className={inputClass} value={form.car_id} onChange={e => update('car_id', e.target.value)} required>
            <option value="">{t.selectCarLabel}</option>
            {cars.map(car => (
              <option key={car.id} value={car.id}>
                {car.brand} {car.model} ({car.year}) - {formatPrice(Number(car.price_per_day))}/day
              </option>
            ))}
          </select>
        </div>

        {/* Dates & Locations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.datesLocations}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.pickupLocation} *</label>
              <select className={inputClass} value={form.pickup_location} onChange={e => update('pickup_location', e.target.value)} required>
                <option value="">{t.selectLocation}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.dropoffLocation} *</label>
              <select className={inputClass} value={form.dropoff_location} onChange={e => update('dropoff_location', e.target.value)} required>
                <option value="">{t.selectLocation}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.pickupDate} *</label>
              <input type="date" className={inputClass} value={form.pickup_date} onChange={e => update('pickup_date', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t.returnDate}</label>
              <input type="date" className={inputClass} value={form.dropoff_date} onChange={e => update('dropoff_date', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t.pickupTime}</label>
              <input type="time" className={inputClass} value={form.pickup_time} onChange={e => update('pickup_time', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t.returnTime}</label>
              <input type="time" className={inputClass} value={form.dropoff_time} onChange={e => update('dropoff_time', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Extras */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.extras}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extras.map(ext => {
              const isSelected = selectedExtras.some(e => e.extra_id === ext.id);
              return (
                <button
                  key={ext.id}
                  type="button"
                  onClick={() => toggleExtra(ext.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected ? 'border-[#FF4D30] bg-[#FF4D30]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{ext.name}</span>
                    <span className="text-[#FF4D30] font-bold text-sm">{formatPrice(Number(ext.price_per_day))}/day</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{ext.description}</p>
                  {isSelected && totalDays > 0 && (
                    <p className="text-[#FF4D30] text-xs mt-1 font-medium">
                      Total: {formatPrice(Number(ext.price_per_day) * totalDays)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes & Status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.notesStatus}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.customerNotes}</label>
              <textarea rows={3} className={inputClass + ' resize-none'} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Any special requests..." />
            </div>
            <div>
              <label className={labelClass}>{t.adminNotesLabel}</label>
              <textarea rows={3} className={inputClass + ' resize-none'} value={form.admin_notes} onChange={e => update('admin_notes', e.target.value)} placeholder={t.internalNotes} />
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <label className={labelClass}>{t.initialStatus}</label>
            <select className={inputClass} value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="pending">{t.pending}</option>
              <option value="confirmed">{t.confirmed}</option>
              <option value="active">{t.active}</option>
            </select>
          </div>
        </div>

        {/* Price Summary */}
        {selectedCar && totalDays > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.priceSummary}</h2>
            <div className="space-y-2 max-w-sm">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{selectedCar.brand} {selectedCar.model} x {totalDays} day{totalDays > 1 ? 's' : ''}</span>
                <span className="text-gray-900">{formatPrice(basePrice)}</span>
              </div>
              {selectedExtras.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.extras}</span>
                  <span className="text-gray-900">{formatPrice(extrasPrice)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between text-lg font-bold">
                <span className="text-gray-900">{t.total}</span>
                <span className="text-[#FF4D30]">{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <a href="/admin/reservations" className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">{t.cancel}</a>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#FF4D30] text-white text-sm font-semibold rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
          >
            {loading ? t.creating : t.createReservationInvoice}
          </button>
        </div>
      </form>
    </div>
  );
}
