'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Save, Check } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

export default function AdminSettingsPage() {
  const { t } = useLanguageStore();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [company, setCompany] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    whatsapp: '',
    working_hours_weekday: '',
    working_hours_weekend: '',
    facebook: '',
    instagram: '',
    tiktok: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/admin/settings');
        setSettings(data.settings);
        const s = data.settings;
        setCompany({
          name: (s.company_name as string) || '',
          phone: (s.company_phone as string) || '',
          email: (s.company_email as string) || '',
          address: (s.company_address as string) || '',
          city: (s.company_city as string) || '',
          whatsapp: (s.whatsapp as string) || '',
          working_hours_weekday: (s.working_hours_weekday as string) || '',
          working_hours_weekend: (s.working_hours_weekend as string) || '',
          facebook: (s.facebook as string) || '',
          instagram: (s.instagram as string) || '',
          tiktok: (s.tiktok as string) || '',
        });
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/admin/settings', {
        company_name: company.name,
        company_phone: company.phone,
        company_email: company.email,
        company_address: company.address,
        company_city: company.city,
        whatsapp: company.whatsapp,
        working_hours_weekday: company.working_hours_weekday,
        working_hours_weekend: company.working_hours_weekend,
        facebook: company.facebook,
        instagram: company.instagram,
        tiktok: company.tiktok,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.settings}</h1>
        <div className="bg-white rounded-xl p-6 animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.settings}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors disabled:opacity-50"
        >
          {saved ? <><Check className="w-4 h-4" /> {t.saved}</> : saving ? t.saving : <><Save className="w-4 h-4" /> {t.saveChanges}</>}
        </button>
      </div>

      {/* Company Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.companyInfo}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>{t.companyName}</label>
            <input className={inputClass} value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.phone}</label>
            <input className={inputClass} value={company.phone} onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.email}</label>
            <input type="email" className={inputClass} value={company.email} onChange={e => setCompany(c => ({ ...c, email: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.whatsappNumber}</label>
            <input className={inputClass} value={company.whatsapp} onChange={e => setCompany(c => ({ ...c, whatsapp: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.address}</label>
            <input className={inputClass} value={company.address} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.city}</label>
            <input className={inputClass} value={company.city} onChange={e => setCompany(c => ({ ...c, city: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.workingHoursTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>{t.weekdays}</label>
            <input className={inputClass} placeholder="08:00 - 20:00" value={company.working_hours_weekday} onChange={e => setCompany(c => ({ ...c, working_hours_weekday: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.weekends}</label>
            <input className={inputClass} placeholder="09:00 - 18:00" value={company.working_hours_weekend} onChange={e => setCompany(c => ({ ...c, working_hours_weekend: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.socialMedia}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>{t.facebookUrl}</label>
            <input className={inputClass} placeholder="https://facebook.com/..." value={company.facebook} onChange={e => setCompany(c => ({ ...c, facebook: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.instagramUrl}</label>
            <input className={inputClass} placeholder="https://instagram.com/..." value={company.instagram} onChange={e => setCompany(c => ({ ...c, instagram: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t.tiktokUrl}</label>
            <input className={inputClass} placeholder="https://tiktok.com/..." value={company.tiktok} onChange={e => setCompany(c => ({ ...c, tiktok: e.target.value }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
