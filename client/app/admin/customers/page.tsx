'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import { Search, X } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function formatPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  total_bookings: string;
  total_spent: string;
  last_booking: string | null;
}

interface CustomerDetail extends Customer {
  reservations: {
    id: string;
    reservation_no: string;
    brand: string;
    model: string;
    pickup_date: string;
    dropoff_date: string;
    status: string;
    total_price: number;
  }[];
}

export default function AdminCustomersPage() {
  const { t } = useLanguageStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        const { data } = await api.get(`/admin/customers?${params}`);
        setCustomers(data.customers);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [search]);

  const viewCustomer = async (id: string) => {
    try {
      const { data } = await api.get(`/admin/customers/${id}`);
      setSelected(data.customer);
    } catch (err) {
      console.error('Failed to fetch customer:', err);
    }
  };

  const columns = [
    {
      key: 'name', label: t.name,
      render: (c: Customer) => (
        <div>
          <p className="font-medium text-gray-900">{c.first_name} {c.last_name}</p>
          <p className="text-xs text-gray-500">{c.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: t.phone, render: (c: Customer) => c.phone ? (
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{c.phone}</span>
        <a
          href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Chat on WhatsApp"
          className="text-green-500 hover:text-green-600 transition-colors"
        >
          <WhatsAppIcon className="w-3.5 h-3.5" />
        </a>
      </div>
    ) : <span className="text-sm">—</span> },
    { key: 'total_bookings', label: t.bookings, render: (c: Customer) => <span className="font-semibold">{c.total_bookings}</span> },
    { key: 'total_spent', label: t.totalSpent, render: (c: Customer) => <span className="font-semibold text-gray-900">{formatPrice(Number(c.total_spent))}</span> },
    {
      key: 'last_booking', label: t.lastBooking,
      render: (c: Customer) => <span className="text-sm text-gray-500">{c.last_booking ? formatDate(c.last_booking) : '—'}</span>,
    },
    {
      key: 'actions', label: '',
      render: (c: Customer) => (
        <button onClick={(e) => { e.stopPropagation(); viewCustomer(c.id); }} className="text-[#FF4D30] hover:underline text-sm font-medium">
          {t.view}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.customersTitle}</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t.searchCustomersPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
        />
      </div>

      <DataTable
        columns={columns as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]}
        data={customers as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage={t.noCustomersFound}
      />

      {/* Customer detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{selected.first_name} {selected.last_name}</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">{t.email}</p><p className="font-medium">{selected.email}</p></div>
                <div>
                  <p className="text-gray-500">{t.phone}</p>
                  {selected.phone ? (
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{selected.phone}</p>
                      <a
                        href={`https://wa.me/${formatPhoneForWhatsApp(selected.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Chat on WhatsApp"
                        className="inline-flex items-center gap-1 text-green-500 hover:text-green-600 transition-colors"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">WhatsApp</span>
                      </a>
                    </div>
                  ) : (
                    <p className="font-medium">—</p>
                  )}
                </div>
                <div><p className="text-gray-500">{t.memberSince}</p><p className="font-medium">{formatDate(selected.created_at)}</p></div>
                <div><p className="text-gray-500">{t.totalSpent}</p><p className="font-medium text-[#FF4D30]">{formatPrice(Number(selected.total_spent))}</p></div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">{t.rentalHistory}</h3>
                {selected.reservations?.length > 0 ? (
                  <div className="space-y-2">
                    {selected.reservations.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{r.brand} {r.model}</p>
                          <p className="text-xs text-gray-500">{formatDate(r.pickup_date)} — {formatDate(r.dropoff_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(r.total_price)}</p>
                          <span className={`text-xs capitalize ${r.status === 'completed' ? 'text-green-600' : r.status === 'cancelled' ? 'text-red-500' : 'text-blue-500'}`}>{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{t.noRentalsYet}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
