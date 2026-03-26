'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import { Search, X } from 'lucide-react';

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
      key: 'name', label: 'Name',
      render: (c: Customer) => (
        <div>
          <p className="font-medium text-gray-900">{c.first_name} {c.last_name}</p>
          <p className="text-xs text-gray-500">{c.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (c: Customer) => <span className="text-sm">{c.phone || '—'}</span> },
    { key: 'total_bookings', label: 'Bookings', render: (c: Customer) => <span className="font-semibold">{c.total_bookings}</span> },
    { key: 'total_spent', label: 'Total Spent', render: (c: Customer) => <span className="font-semibold text-gray-900">{formatPrice(Number(c.total_spent))}</span> },
    {
      key: 'last_booking', label: 'Last Booking',
      render: (c: Customer) => <span className="text-sm text-gray-500">{c.last_booking ? formatDate(c.last_booking) : '—'}</span>,
    },
    {
      key: 'actions', label: '',
      render: (c: Customer) => (
        <button onClick={(e) => { e.stopPropagation(); viewCustomer(c.id); }} className="text-[#FF4D30] hover:underline text-sm font-medium">
          View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">Customers</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
        />
      </div>

      <DataTable
        columns={columns as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]}
        data={customers as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No customers found"
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
                <div><p className="text-gray-500">Email</p><p className="font-medium">{selected.email}</p></div>
                <div><p className="text-gray-500">Phone</p><p className="font-medium">{selected.phone || '—'}</p></div>
                <div><p className="text-gray-500">Member Since</p><p className="font-medium">{formatDate(selected.created_at)}</p></div>
                <div><p className="text-gray-500">Total Spent</p><p className="font-medium text-[#FF4D30]">{formatPrice(Number(selected.total_spent))}</p></div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Rental History</h3>
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
                  <p className="text-sm text-gray-400">No rentals yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
