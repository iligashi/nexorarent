'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import { DollarSign, Plus, Edit, Trash2, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExpenseCategory =
  | 'insurance'
  | 'repair'
  | 'fuel'
  | 'tire'
  | 'wash'
  | 'parking'
  | 'tax'
  | 'registration'
  | 'other';

interface Expense {
  id: string;
  car_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expense_date: string;
  vendor: string;
  receipt_url: string;
  created_at: string;
  car_brand: string;
  car_model: string;
}

interface ProfitSummary {
  car_id: string;
  car_brand: string;
  car_model: string;
  total_expenses: number;
  total_revenue: number;
  profit: number;
  expense_count: number;
}

interface Car {
  id: string;
  brand: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

const CATEGORIES: ExpenseCategory[] = [
  'insurance',
  'repair',
  'fuel',
  'tire',
  'wash',
  'parking',
  'tax',
  'registration',
  'other',
];

const categoryColors: Record<ExpenseCategory, string> = {
  insurance: 'bg-blue-100 text-blue-700',
  repair: 'bg-orange-100 text-orange-700',
  fuel: 'bg-amber-100 text-amber-700',
  tire: 'bg-gray-100 text-gray-700',
  wash: 'bg-cyan-100 text-cyan-700',
  parking: 'bg-purple-100 text-purple-700',
  tax: 'bg-red-100 text-red-700',
  registration: 'bg-green-100 text-green-700',
  other: 'bg-slate-100 text-slate-700',
};

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <span
      className={cn(
        'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
        categoryColors[category] ?? 'bg-gray-100 text-gray-700',
      )}
    >
      {category}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty form
// ---------------------------------------------------------------------------

const emptyForm = {
  car_id: '',
  category: 'other' as ExpenseCategory,
  amount: '',
  description: '',
  expense_date: '',
  vendor: '',
  receipt_url: '',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminExpensesPage() {
  const { t } = useLanguageStore();
  // Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ProfitSummary[]>([]);
  const [cars, setCars] = useState<Car[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expenses' | 'profitability'>('expenses');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch helpers
  // -------------------------------------------------------------------------

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const { data } = await api.get(`/admin/expenses?${params}`);
      setExpenses(data.expenses);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/expenses/summary');
      setSummary(
        data.summary.map((s: Record<string, unknown>) => ({
          ...s,
          total_expenses: Number(s.total_expenses),
          total_revenue: Number(s.total_revenue),
          profit: Number(s.profit),
          expense_count: Number(s.expense_count),
        })),
      );
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, []);

  const fetchCars = useCallback(async () => {
    try {
      const { data } = await api.get('/cars?limit=100');
      setCars(data.cars ?? data);
    } catch (err) {
      console.error('Failed to fetch cars:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  useEffect(() => {
    if (tab === 'expenses') fetchExpenses();
    else fetchSummary();
  }, [tab, fetchExpenses, fetchSummary]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const totalExpensesAmount = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0,
  );

  const totalPages = Math.ceil(total / limit);

  // -------------------------------------------------------------------------
  // Modal actions
  // -------------------------------------------------------------------------

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      car_id: e.car_id,
      category: e.category,
      amount: String(e.amount),
      description: e.description ?? '',
      expense_date: e.expense_date ? e.expense_date.slice(0, 10) : '',
      vendor: e.vendor ?? '',
      receipt_url: e.receipt_url ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        car_id: form.car_id,
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
        expense_date: form.expense_date,
        vendor: form.vendor,
        receipt_url: form.receipt_url,
      };
      if (editingId) {
        await api.put(`/admin/expenses/${editingId}`, body);
      } else {
        await api.post('/admin/expenses', body);
      }
      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      console.error('Failed to save expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/expenses/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchExpenses();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Table columns
  // -------------------------------------------------------------------------

  const columns = [
    {
      key: 'car',
      label: t.car,
      render: (row: Expense) => (
        <span className="font-medium text-gray-900">
          {row.car_brand} {row.car_model}
        </span>
      ),
    },
    {
      key: 'category',
      label: t.category,
      render: (row: Expense) => <CategoryBadge category={row.category} />,
    },
    {
      key: 'amount',
      label: t.amount,
      render: (row: Expense) => (
        <span className="font-semibold text-gray-900">
          {formatPrice(Number(row.amount))}
        </span>
      ),
    },
    {
      key: 'description',
      label: t.description,
      render: (row: Expense) => (
        <span className="text-gray-600 truncate max-w-[200px] block">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'vendor',
      label: t.vendor,
      render: (row: Expense) => (
        <span className="text-gray-600">{row.vendor || '—'}</span>
      ),
    },
    {
      key: 'expense_date',
      label: t.date,
      render: (row: Expense) => (
        <span className="text-sm text-gray-500">
          {row.expense_date ? formatDate(row.expense_date) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (row: Expense) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#FF4D30] transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-outfit">
            {t.expenseTracking}
          </h1>
          {!loading && tab === 'expenses' && (
            <p className="text-sm text-gray-500 mt-1">
              {t.totalExpenses}{' '}
              <span className="font-semibold text-gray-900">
                {formatPrice(totalExpensesAmount)}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e5432a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addExpense}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('expenses')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'expenses'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {t.allExpenses}
        </button>
        <button
          onClick={() => setTab('profitability')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'profitability'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {t.profitabilitySummary}
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Expenses tab                                                      */}
      {/* ----------------------------------------------------------------- */}
      {tab === 'expenses' && (
        <>
          {/* Category filter */}
          <div className="flex items-center gap-3">
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
            >
              <option value="">{t.allCategories}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <DataTable
            columns={
              columns as {
                key: string;
                label: string;
                render?: (row: Record<string, unknown>) => React.ReactNode;
                className?: string;
              }[]
            }
            data={expenses as unknown as Record<string, unknown>[]}
            loading={loading}
            emptyMessage={t.noExpensesFound}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t.previous}
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Profitability tab                                                 */}
      {/* ----------------------------------------------------------------- */}
      {tab === 'profitability' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.length === 0 && !loading && (
            <p className="col-span-full text-center text-sm text-gray-400 py-12">
              {t.profitabilityNoData}
            </p>
          )}
          {summary.map((s) => {
            const isProfit = s.profit >= 0;
            return (
              <div
                key={s.car_id}
                className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    {s.car_brand} {s.car_model}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {s.expense_count} expense{s.expense_count !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t.revenue}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatPrice(s.total_revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t.expenses}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatPrice(s.total_expenses)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t.profit}</p>
                    <p
                      className={cn(
                        'text-sm font-bold',
                        isProfit ? 'text-green-600' : 'text-red-600',
                      )}
                    >
                      {formatPrice(s.profit)}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium',
                    isProfit
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700',
                  )}
                >
                  {isProfit ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {isProfit ? t.profitable : t.loss}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Add / Edit modal                                                  */}
      {/* ----------------------------------------------------------------- */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? t.editExpense : t.addExpense}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Car */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.car}
                </label>
                <select
                  value={form.car_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, car_id: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  <option value="">{t.selectCar}</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brand} {c.model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.category}
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as ExpenseCategory,
                    }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.amount}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.description}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.briefDescription}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.expenseDate}
                </label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expense_date: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.vendor}
                </label>
                <input
                  type="text"
                  placeholder={t.vendorName}
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Receipt URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.receiptUrl}
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.receipt_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, receipt_url: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* Submit */}
              <button
                disabled={saving || !form.car_id || !form.amount}
                onClick={handleSave}
                className="w-full py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e5432a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving
                  ? t.saving
                  : editingId
                    ? t.updateExpense
                    : t.addExpense}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Delete confirmation modal                                         */}
      {/* ----------------------------------------------------------------- */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {t.deleteExpense}
              </h3>
              <p className="text-sm text-gray-500">
                {t.deleteExpenseConfirm}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? t.deleting : t.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
