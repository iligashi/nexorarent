'use client';

import { useState } from 'react';
import type { Car } from '@/types';

const categories = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'sports'];
const fuelTypes = ['petrol', 'diesel', 'hybrid', 'electric'];
const transmissions = ['manual', 'automatic'];
const commonFeatures = ['GPS', 'Air Conditioning', 'Bluetooth', 'USB', 'Cruise Control', 'Parking Sensors', 'Backup Camera', 'Heated Seats', 'Leather Seats', 'Sunroof', 'Apple CarPlay', 'Android Auto', 'Keyless Entry', 'ABS', 'Airbags'];

interface CarFormProps {
  car?: Car;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
}

export default function CarForm({ car, onSubmit, loading }: CarFormProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year || new Date().getFullYear(),
    category: car?.category || 'sedan',
    fuel: car?.fuel || 'petrol',
    transmission: car?.transmission || 'manual',
    seats: car?.seats || 5,
    doors: car?.doors || 4,
    horsepower: car?.horsepower || '',
    engine_cc: car?.engine_cc || '',
    color: car?.color || '',
    license_plate: '',
    mileage: car?.mileage || 0,
    price_per_day: car?.price_per_day || '',
    price_per_week: car?.price_per_week || '',
    deposit: car?.deposit || 0,
    description: car?.description || '',
    features: car?.features || [],
    is_featured: car?.is_featured || false,
  });

  const update = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleFeature = (feature: string) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const tabs = ['Details', 'Pricing', 'Features'];
  const inputClass = 'w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Tabs */}
      <div className="border-b border-gray-100 px-6">
        <div className="flex gap-6">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === i ? 'border-[#FF4D30] text-[#FF4D30]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Details tab */}
        {activeTab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Brand *</label>
              <input className={inputClass} value={form.brand} onChange={e => update('brand', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Model *</label>
              <input className={inputClass} value={form.model} onChange={e => update('model', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Year *</label>
              <input type="number" className={inputClass} value={form.year} onChange={e => update('year', Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelClass}>Category *</label>
              <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fuel Type *</label>
              <select className={inputClass} value={form.fuel} onChange={e => update('fuel', e.target.value)}>
                {fuelTypes.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Transmission *</label>
              <select className={inputClass} value={form.transmission} onChange={e => update('transmission', e.target.value)}>
                {transmissions.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Seats</label>
              <input type="number" className={inputClass} value={form.seats} onChange={e => update('seats', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Doors</label>
              <input type="number" className={inputClass} value={form.doors} onChange={e => update('doors', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Horsepower</label>
              <input type="number" className={inputClass} value={form.horsepower} onChange={e => update('horsepower', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Engine CC</label>
              <input type="number" className={inputClass} value={form.engine_cc} onChange={e => update('engine_cc', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <input className={inputClass} value={form.color} onChange={e => update('color', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>License Plate</label>
              <input className={inputClass} value={form.license_plate} onChange={e => update('license_plate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Mileage (km)</label>
              <input type="number" className={inputClass} value={form.mileage} onChange={e => update('mileage', Number(e.target.value))} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea rows={4} className={inputClass + ' resize-none'} value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
          </div>
        )}

        {/* Pricing tab */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-xl">
            <div>
              <label className={labelClass}>Price Per Day (EUR) *</label>
              <input type="number" step="0.01" className={inputClass} value={form.price_per_day} onChange={e => update('price_per_day', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Price Per Week (EUR)</label>
              <input type="number" step="0.01" className={inputClass} value={form.price_per_week || ''} onChange={e => update('price_per_week', e.target.value || null)} />
            </div>
            <div>
              <label className={labelClass}>Deposit (EUR)</label>
              <input type="number" step="0.01" className={inputClass} value={form.deposit} onChange={e => update('deposit', Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="featured" checked={form.is_featured} onChange={e => update('is_featured', e.target.checked)} className="w-4 h-4 text-[#FF4D30] rounded" />
              <label htmlFor="featured" className="text-sm font-medium text-gray-700">Featured car (shown on homepage)</label>
            </div>
          </div>
        )}

        {/* Features tab */}
        {activeTab === 2 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Select the features this car has:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {commonFeatures.map(feature => (
                <label key={feature} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${form.features.includes(feature) ? 'bg-[#FF4D30]/5 border-[#FF4D30] text-[#FF4D30]' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={form.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{feature}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
        <a href="/admin/cars" className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</a>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[#FF4D30] text-white text-sm font-semibold rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : car ? 'Update Car' : 'Create Car'}
        </button>
      </div>
    </form>
  );
}
