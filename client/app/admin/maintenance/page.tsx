'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import {
  Wrench,
  AlertTriangle,
  Plus,
  Edit,
  Check,
  Clock,
  Calendar,
  X,
} from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MaintenanceType {
  id: string;
  name: string;
  description: string;
  interval_km: number | null;
  interval_days: number | null;
  estimated_cost: number | null;
  is_active: boolean;
}

interface MaintenanceRecord {
  id: string;
  car_id: string;
  maintenance_type_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  scheduled_date: string;
  completed_date: string | null;
  mileage_at_service: number | null;
  next_due_mileage: number | null;
  next_due_date: string | null;
  cost: number | null;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  type_name: string;
  car_brand: string;
  car_model: string;
}

interface MaintenanceAlert {
  id: string;
  car_id: string;
  car_brand: string;
  car_model: string;
  type_name: string;
  scheduled_date: string;
  status: string;
  [key: string]: unknown;
}

interface Car {
  id: string;
  brand: string;
  model: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Status badge helper                                                */
/* ------------------------------------------------------------------ */

const statusConfigStyles: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-50', text: 'text-green-700' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700' },
  cancelled: { bg: 'bg-gray-50', text: 'text-gray-500' },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = statusConfigStyles[status] || statusConfigStyles.scheduled;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type TabKey = 'alerts' | 'records' | 'types';

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminMaintenancePage() {
  const { t } = useLanguageStore();
  // --- shared state ---
  const [activeTab, setActiveTab] = useState<TabKey>('alerts');

  const statusLabelsMap: Record<string, string> = {
    scheduled: t.scheduled,
    in_progress: t.inProgress,
    completed: t.completed,
    overdue: t.overdue,
    cancelled: t.cancelled,
  };

  const mainTabs = [
    { key: 'alerts' as TabKey, label: t.alerts, icon: AlertTriangle },
    { key: 'records' as TabKey, label: t.records, icon: Wrench },
    { key: 'types' as TabKey, label: t.types, icon: Clock },
  ];

  const statusFilterTabs = [
    { label: t.all, value: 'all' },
    { label: t.scheduled, value: 'scheduled' },
    { label: t.inProgress, value: 'in_progress' },
    { label: t.completed, value: 'completed' },
    { label: t.overdue, value: 'overdue' },
    { label: t.cancelled, value: 'cancelled' },
  ];

  // --- alerts ---
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  // --- records ---
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordStatusFilter, setRecordStatusFilter] = useState('all');
  const [recordPage, setRecordPage] = useState(1);
  const recordLimit = 20;

  // --- types ---
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);

  // --- cars list for dropdowns ---
  const [cars, setCars] = useState<Car[]>([]);

  // --- modals ---
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<MaintenanceType | null>(null);

  // --- record form ---
  const [recordForm, setRecordForm] = useState({
    car_id: '',
    maintenance_type_id: '',
    scheduled_date: '',
    mileage_at_service: '',
    vendor: '',
    notes: '',
  });
  const [recordSaving, setRecordSaving] = useState(false);

  // --- complete form ---
  const [completeForm, setCompleteForm] = useState({ cost: '', notes: '' });
  const [completeSaving, setCompleteSaving] = useState(false);

  // --- type form ---
  const [typeForm, setTypeForm] = useState({
    name: '',
    description: '',
    interval_km: '',
    interval_days: '',
    estimated_cost: '',
    is_active: true,
  });
  const [typeSaving, setTypeSaving] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetchers                                                         */
  /* ---------------------------------------------------------------- */

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const { data } = await api.get('/admin/maintenance/alerts');
      setAlerts([...(data.overdue || []), ...(data.upcoming || [])]);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const params = new URLSearchParams();
      if (recordStatusFilter !== 'all') params.set('status', recordStatusFilter);
      params.set('page', String(recordPage));
      params.set('limit', String(recordLimit));
      const { data } = await api.get(`/admin/maintenance/records?${params}`);
      setRecords(data.records);
      setRecordsTotal(data.pagination?.total ?? data.total ?? 0);
    } catch (err) {
      console.error('Failed to fetch records:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  const fetchTypes = async () => {
    setTypesLoading(true);
    try {
      const { data } = await api.get('/admin/maintenance/types');
      setTypes(data.types);
    } catch (err) {
      console.error('Failed to fetch types:', err);
    } finally {
      setTypesLoading(false);
    }
  };

  const fetchCars = async () => {
    try {
      const { data } = await api.get('/cars?limit=100');
      setCars(data.cars || data);
    } catch (err) {
      console.error('Failed to fetch cars:', err);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Effects                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    fetchAlerts();
    fetchTypes();
    fetchCars();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [recordStatusFilter, recordPage]);

  /* ---------------------------------------------------------------- */
  /*  Record save                                                      */
  /* ---------------------------------------------------------------- */

  const openAddRecord = () => {
    setEditingRecord(null);
    setRecordForm({
      car_id: '',
      maintenance_type_id: '',
      scheduled_date: '',
      mileage_at_service: '',
      vendor: '',
      notes: '',
    });
    setShowRecordModal(true);
  };

  const openEditRecord = (r: MaintenanceRecord) => {
    setEditingRecord(r);
    setRecordForm({
      car_id: r.car_id,
      maintenance_type_id: r.maintenance_type_id,
      scheduled_date: r.scheduled_date ? r.scheduled_date.slice(0, 10) : '',
      mileage_at_service: r.mileage_at_service != null ? String(r.mileage_at_service) : '',
      vendor: r.vendor || '',
      notes: r.notes || '',
    });
    setShowRecordModal(true);
  };

  const saveRecord = async () => {
    setRecordSaving(true);
    try {
      const body = {
        car_id: recordForm.car_id,
        maintenance_type_id: recordForm.maintenance_type_id,
        scheduled_date: recordForm.scheduled_date,
        mileage_at_service: recordForm.mileage_at_service ? Number(recordForm.mileage_at_service) : null,
        vendor: recordForm.vendor || null,
        notes: recordForm.notes || null,
      };
      if (editingRecord) {
        await api.put(`/admin/maintenance/records/${editingRecord.id}`, body);
      } else {
        await api.post('/admin/maintenance/records', body);
      }
      setShowRecordModal(false);
      fetchRecords();
      fetchAlerts();
    } catch (err) {
      console.error('Failed to save record:', err);
    } finally {
      setRecordSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Complete record                                                  */
  /* ---------------------------------------------------------------- */

  const openCompleteModal = (r: MaintenanceRecord) => {
    setCompletingRecord(r);
    setCompleteForm({ cost: '', notes: '' });
    setShowCompleteModal(true);
  };

  const completeRecord = async () => {
    if (!completingRecord) return;
    setCompleteSaving(true);
    try {
      await api.put(`/admin/maintenance/records/${completingRecord.id}/complete`, {
        cost: completeForm.cost ? Number(completeForm.cost) : 0,
        notes: completeForm.notes || null,
      });
      setShowCompleteModal(false);
      fetchRecords();
      fetchAlerts();
    } catch (err) {
      console.error('Failed to complete record:', err);
    } finally {
      setCompleteSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Type save                                                        */
  /* ---------------------------------------------------------------- */

  const openAddType = () => {
    setEditingType(null);
    setTypeForm({ name: '', description: '', interval_km: '', interval_days: '', estimated_cost: '', is_active: true });
    setShowTypeModal(true);
  };

  const openEditType = (t: MaintenanceType) => {
    setEditingType(t);
    setTypeForm({
      name: t.name,
      description: t.description || '',
      interval_km: t.interval_km != null ? String(t.interval_km) : '',
      interval_days: t.interval_days != null ? String(t.interval_days) : '',
      estimated_cost: t.estimated_cost != null ? String(t.estimated_cost) : '',
      is_active: t.is_active,
    });
    setShowTypeModal(true);
  };

  const saveType = async () => {
    setTypeSaving(true);
    try {
      const body = {
        name: typeForm.name,
        description: typeForm.description || null,
        interval_km: typeForm.interval_km ? Number(typeForm.interval_km) : null,
        interval_days: typeForm.interval_days ? Number(typeForm.interval_days) : null,
        estimated_cost: typeForm.estimated_cost ? Number(typeForm.estimated_cost) : null,
        is_active: typeForm.is_active,
      };
      if (editingType) {
        await api.put(`/admin/maintenance/types/${editingType.id}`, body);
      } else {
        await api.post('/admin/maintenance/types', body);
      }
      setShowTypeModal(false);
      fetchTypes();
    } catch (err) {
      console.error('Failed to save type:', err);
    } finally {
      setTypeSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Alert urgency helper                                             */
  /* ---------------------------------------------------------------- */

  function alertUrgency(alert: MaintenanceAlert): 'overdue' | 'upcoming' {
    if (alert.status === 'overdue') return 'overdue';
    const scheduled = new Date(alert.scheduled_date);
    return scheduled < new Date() ? 'overdue' : 'upcoming';
  }

  /* ---------------------------------------------------------------- */
  /*  Record columns                                                   */
  /* ---------------------------------------------------------------- */

  const recordColumns = [
    {
      key: 'car',
      label: 'Car',
      render: (r: MaintenanceRecord) => (
        <span className="font-medium text-gray-900">{r.car_brand} {r.car_model}</span>
      ),
    },
    {
      key: 'type_name',
      label: 'Type',
      render: (r: MaintenanceRecord) => <span>{r.type_name}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: MaintenanceRecord) => <StatusBadge status={r.status} label={statusLabelsMap[r.status] || r.status} />,
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled Date',
      render: (r: MaintenanceRecord) => <span>{formatDate(r.scheduled_date)}</span>,
    },
    {
      key: 'vendor',
      label: 'Vendor',
      render: (r: MaintenanceRecord) => <span className="text-gray-600">{r.vendor || '-'}</span>,
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (r: MaintenanceRecord) => (
        <span className="font-semibold text-gray-900">{r.cost != null ? formatPrice(r.cost) : '-'}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: MaintenanceRecord) => (
        <div className="flex items-center gap-2">
          {(r.status === 'scheduled' || r.status === 'in_progress') && (
            <button
              onClick={(e) => { e.stopPropagation(); openCompleteModal(r); }}
              title="Mark Complete"
              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {r.status !== 'completed' && r.status !== 'cancelled' && (
            <button
              onClick={(e) => { e.stopPropagation(); openEditRecord(r); }}
              title="Edit"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  /* ---------------------------------------------------------------- */
  /*  Pagination                                                       */
  /* ---------------------------------------------------------------- */

  const totalPages = Math.ceil(recordsTotal / recordLimit);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-outfit">Maintenance Scheduler</h1>
          {alerts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={openAddRecord}
          className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Record
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/*  ALERTS TAB                                                   */}
      {/* ============================================================ */}
      {activeTab === 'alerts' && (
        <div>
          {alertsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No upcoming or overdue maintenance alerts.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => {
                const urgency = alertUrgency(alert);
                const isOverdue = urgency === 'overdue';
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'rounded-xl border p-5 transition-shadow hover:shadow-md',
                      isOverdue
                        ? 'bg-red-50 border-red-200'
                        : 'bg-orange-50 border-orange-200'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          className={cn(
                            'w-5 h-5',
                            isOverdue ? 'text-red-500' : 'text-orange-500'
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-bold uppercase tracking-wide',
                            isOverdue ? 'text-red-600' : 'text-orange-600'
                          )}
                        >
                          {isOverdue ? 'Overdue' : 'Upcoming'}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{alert.type_name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {alert.car_brand} {alert.car_model}
                    </p>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(alert.scheduled_date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  RECORDS TAB                                                  */}
      {/* ============================================================ */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {statusFilterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setRecordStatusFilter(tab.value); setRecordPage(1); }}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  recordStatusFilter === tab.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <DataTable
            columns={recordColumns}
            data={records}
            loading={recordsLoading}
            emptyMessage="No maintenance records found"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(recordPage - 1) * recordLimit + 1}&ndash;{Math.min(recordPage * recordLimit, recordsTotal)} of {recordsTotal}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecordPage((p) => Math.max(1, p - 1))}
                  disabled={recordPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setRecordPage((p) => Math.min(totalPages, p + 1))}
                  disabled={recordPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  TYPES TAB                                                    */}
      {/* ============================================================ */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAddType}
              className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Type
            </button>
          </div>

          {typesLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          ) : types.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No maintenance types defined yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <button
                      onClick={() => openEditType(t)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                  {t.description && (
                    <p className="text-sm text-gray-500 mb-3">{t.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {t.interval_km != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Every {t.interval_km.toLocaleString()} km
                      </span>
                    )}
                    {t.interval_days != null && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Every {t.interval_days} days
                      </span>
                    )}
                    {t.estimated_cost != null && (
                      <span className="font-medium text-gray-700">
                        ~{formatPrice(t.estimated_cost)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        t.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  ADD / EDIT RECORD MODAL                                      */}
      {/* ============================================================ */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRecordModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingRecord ? 'Edit Record' : 'New Maintenance Record'}
              </h2>
              <button onClick={() => setShowRecordModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Car */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Car</label>
                <select
                  value={recordForm.car_id}
                  onChange={(e) => setRecordForm((f) => ({ ...f, car_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  <option value="">Select a car</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brand} {c.model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
                <select
                  value={recordForm.maintenance_type_id}
                  onChange={(e) => setRecordForm((f) => ({ ...f, maintenance_type_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  <option value="">Select type</option>
                  {types.filter((t) => t.is_active).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={recordForm.scheduled_date}
                  onChange={(e) => setRecordForm((f) => ({ ...f, scheduled_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mileage at Service</label>
                <input
                  type="number"
                  value={recordForm.mileage_at_service}
                  onChange={(e) => setRecordForm((f) => ({ ...f, mileage_at_service: e.target.value }))}
                  placeholder="e.g. 45000"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <input
                  type="text"
                  value={recordForm.vendor}
                  onChange={(e) => setRecordForm((f) => ({ ...f, vendor: e.target.value }))}
                  placeholder="Service provider name"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRecord}
                  disabled={recordSaving || !recordForm.car_id || !recordForm.maintenance_type_id || !recordForm.scheduled_date}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-[#FF4D30] rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
                >
                  {recordSaving ? 'Saving...' : editingRecord ? 'Update Record' : 'Create Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  COMPLETE MODAL                                               */}
      {/* ============================================================ */}
      {showCompleteModal && completingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCompleteModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Complete Maintenance</h2>
              <button onClick={() => setShowCompleteModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{completingRecord.type_name}</p>
                <p className="text-gray-500">{completingRecord.car_brand} {completingRecord.car_model}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Cost</label>
                <input
                  type="number"
                  value={completeForm.cost}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, cost: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completion Notes</label>
                <textarea
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Work performed, parts replaced..."
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={completeRecord}
                  disabled={completeSaving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {completeSaving ? 'Completing...' : 'Mark Complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  ADD / EDIT TYPE MODAL                                        */}
      {/* ============================================================ */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTypeModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingType ? 'Edit Maintenance Type' : 'New Maintenance Type'}
              </h2>
              <button onClick={() => setShowTypeModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Oil Change"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={typeForm.description}
                  onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief description of this maintenance type"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                />
              </div>

              {/* Intervals */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interval (km)</label>
                  <input
                    type="number"
                    value={typeForm.interval_km}
                    onChange={(e) => setTypeForm((f) => ({ ...f, interval_km: e.target.value }))}
                    placeholder="e.g. 10000"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interval (days)</label>
                  <input
                    type="number"
                    value={typeForm.interval_days}
                    onChange={(e) => setTypeForm((f) => ({ ...f, interval_days: e.target.value }))}
                    placeholder="e.g. 180"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* Estimated cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
                <input
                  type="number"
                  value={typeForm.estimated_cost}
                  onChange={(e) => setTypeForm((f) => ({ ...f, estimated_cost: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTypeForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    typeForm.is_active ? 'bg-[#FF4D30]' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      typeForm.is_active ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
                <span className="text-sm text-gray-700">{typeForm.is_active ? 'Active' : 'Inactive'}</span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveType}
                  disabled={typeSaving || !typeForm.name}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-[#FF4D30] rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
                >
                  {typeSaving ? 'Saving...' : editingType ? 'Update Type' : 'Create Type'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
