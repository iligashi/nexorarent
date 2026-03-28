'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Car, CarImage } from '@/types';
import { Plus, Trash2, Star, ImageIcon } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

const categories = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'sports'] as const;
const fuelTypes = ['petrol', 'diesel', 'hybrid', 'electric'] as const;
const transmissions = ['manual', 'automatic'] as const;
const commonFeatures = ['GPS', 'Air Conditioning', 'Bluetooth', 'USB', 'Cruise Control', 'Parking Sensors', 'Backup Camera', 'Heated Seats', 'Leather Seats', 'Sunroof', 'Apple CarPlay', 'Android Auto', 'Keyless Entry', 'ABS', 'Airbags'] as const;

interface CarFormProps {
  car?: Car;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
}

export default function CarForm({ car, onSubmit, loading }: CarFormProps) {
  const { t } = useLanguageStore();

  const categoryLabels: Record<string, string> = { economy: t.economy, compact: t.compact, sedan: t.sedan, suv: t.suv, luxury: t.luxury, van: t.van, sports: t.sports };
  const fuelLabels: Record<string, string> = { petrol: t.petrol, diesel: t.diesel, hybrid: t.hybrid, electric: t.electric };
  const transmissionLabels: Record<string, string> = { manual: t.manual, automatic: t.automatic };
  const featureLabels: Record<string, string> = { 'GPS': t.gps, 'Air Conditioning': t.airConditioning, 'Bluetooth': t.bluetooth, 'USB': t.usb, 'Cruise Control': t.cruiseControl, 'Parking Sensors': t.parkingSensors, 'Backup Camera': t.backupCamera, 'Heated Seats': t.heatedSeats, 'Leather Seats': t.leatherSeats, 'Sunroof': t.sunroof, 'Apple CarPlay': t.appleCarplay, 'Android Auto': t.androidAuto, 'Keyless Entry': t.keylessEntry, 'ABS': t.abs, 'Airbags': t.airbags };
  const tabs = [t.details, t.pricing, t.imagesTab, t.featuresTab];

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

  // Images state
  const [images, setImages] = useState<CarImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [addingImage, setAddingImage] = useState(false);

  useEffect(() => {
    if (car?.images) setImages(car.images);
  }, [car]);

  const update = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleFeature = (feature: string) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const addImageUrl = async () => {
    if (!newImageUrl || !car?.id) return;
    setAddingImage(true);
    try {
      const { data } = await api.post(`/admin/cars/${car.id}/images/url`, {
        url: newImageUrl,
        is_primary: images.length === 0,
      });
      setImages(prev => [...prev, data.image]);
      setNewImageUrl('');
    } catch (err) {
      console.error('Failed to add image:', err);
    } finally {
      setAddingImage(false);
    }
  };

  const deleteImage = async (imgId: string) => {
    if (!car?.id) return;
    try {
      await api.delete(`/admin/cars/${car.id}/images/${imgId}`);
      setImages(prev => prev.filter(i => i.id !== imgId));
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const setPrimary = async (imgId: string) => {
    if (!car?.id) return;
    try {
      // Use the URL endpoint to set as primary by re-adding logic
      // For now, just update locally - the backend can be extended
      await api.post(`/admin/cars/${car.id}/images/url`, {
        url: images.find(i => i.id === imgId)?.url,
        is_primary: true,
      });
      setImages(prev => prev.map(i => ({ ...i, is_primary: i.id === imgId })));
    } catch (err) {
      console.error('Failed to set primary:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

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
              <label className={labelClass}>{t.brand} *</label>
              <input className={inputClass} value={form.brand} onChange={e => update('brand', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t.model} *</label>
              <input className={inputClass} value={form.model} onChange={e => update('model', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t.year} *</label>
              <input type="number" className={inputClass} value={form.year} onChange={e => update('year', Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelClass}>{t.category} *</label>
              <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.fuelType} *</label>
              <select className={inputClass} value={form.fuel} onChange={e => update('fuel', e.target.value)}>
                {fuelTypes.map(f => <option key={f} value={f}>{fuelLabels[f]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.transmission} *</label>
              <select className={inputClass} value={form.transmission} onChange={e => update('transmission', e.target.value)}>
                {transmissions.map(tr => <option key={tr} value={tr}>{transmissionLabels[tr]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.seats}</label>
              <input type="number" className={inputClass} value={form.seats} onChange={e => update('seats', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>{t.doors}</label>
              <input type="number" className={inputClass} value={form.doors} onChange={e => update('doors', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>{t.horsepower}</label>
              <input type="number" className={inputClass} value={form.horsepower} onChange={e => update('horsepower', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>{t.engineCC}</label>
              <input type="number" className={inputClass} value={form.engine_cc} onChange={e => update('engine_cc', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>{t.color}</label>
              <input className={inputClass} value={form.color} onChange={e => update('color', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t.licensePlate}</label>
              <input className={inputClass} value={form.license_plate} onChange={e => update('license_plate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t.mileageKm}</label>
              <input type="number" className={inputClass} value={form.mileage} onChange={e => update('mileage', Number(e.target.value))} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>{t.description}</label>
              <textarea rows={4} className={inputClass + ' resize-none'} value={form.description} onChange={e => update('description', e.target.value)} />
            </div>
          </div>
        )}

        {/* Pricing tab */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-xl">
            <div>
              <label className={labelClass}>{t.pricePerDayEur} *</label>
              <input type="number" step="0.01" className={inputClass} value={form.price_per_day} onChange={e => update('price_per_day', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t.pricePerWeekEur}</label>
              <input type="number" step="0.01" className={inputClass} value={form.price_per_week || ''} onChange={e => update('price_per_week', e.target.value || null)} />
            </div>
            <div>
              <label className={labelClass}>{t.depositEur}</label>
              <input type="number" step="0.01" className={inputClass} value={form.deposit} onChange={e => update('deposit', Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="featured" checked={form.is_featured} onChange={e => update('is_featured', e.target.checked)} className="w-4 h-4 text-[#FF4D30] rounded" />
              <label htmlFor="featured" className="text-sm font-medium text-gray-700">{t.featuredCar}</label>
            </div>
          </div>
        )}

        {/* Images tab */}
        {activeTab === 2 && (
          <div>
            {!car?.id ? (
              <div className="text-center py-12 text-gray-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">{t.saveCarFirst}</p>
              </div>
            ) : (
              <>
                {/* Add image by URL */}
                <div className="mb-6">
                  <label className={labelClass}>{t.addImageUrl}</label>
                  <div className="flex gap-3">
                    <input
                      className={inputClass}
                      placeholder="https://example.com/car-photo.jpg"
                      value={newImageUrl}
                      onChange={e => setNewImageUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      disabled={!newImageUrl || addingImage}
                      className="px-5 py-2.5 bg-[#FF4D30] text-white text-sm font-semibold rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {addingImage ? t.adding : t.addImage}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{t.pasteImageUrl}</p>
                </div>

                {/* Image grid */}
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map(img => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                        <div className="aspect-[4/3] bg-gray-100">
                          <img
                            src={img.url.startsWith('http') ? img.url : `http://localhost:4000${img.url}`}
                            alt={img.alt_text || ''}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {img.is_primary && (
                          <div className="absolute top-2 left-2 bg-[#FF4D30] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" /> {t.primaryImage}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {!img.is_primary && (
                            <button
                              type="button"
                              onClick={() => setPrimary(img.id)}
                              className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100 text-xs font-medium"
                              title={t.setAsPrimary}
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteImage(img.id)}
                            className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">{t.noImagesYet}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Features tab */}
        {activeTab === 3 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">{t.selectFeatures}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {commonFeatures.map(feature => (
                <label key={feature} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${form.features.includes(feature) ? 'bg-[#FF4D30]/5 border-[#FF4D30] text-[#FF4D30]' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={form.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{featureLabels[feature] || feature}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
        <a href="/admin/cars" className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">{t.cancel}</a>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[#FF4D30] text-white text-sm font-semibold rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
        >
          {loading ? t.saving : car ? t.updateCar : t.createCar}
        </button>
      </div>
    </form>
  );
}
