'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguageStore } from '@/stores/languageStore';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Gauge, Plus, Edit, Trash2, Calculator, TrendingUp, Activity,
  X, ChevronDown, AlertTriangle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PricingRule {
  id: number;
  name: string;
  type: 'demand' | 'advance_booking' | 'duration' | 'last_minute' | 'event';
  car_id: number | null;
  category: string | null;
  multiplier: number;
  conditions: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface DemandInfo {
  demand_percent: number;
  level: string;
  active_reservations: number;
  total_cars: number;
}

interface PriceBreakdown {
  daily_rate: number;
  seasonal_multiplier: number;
  dynamic_multiplier: number;
  final_daily_rate: number;
  total_days: number;
  total_price: number;
  demand_percent: number;
  applied_rules: { name: string; multiplier: number }[];
}

interface Car {
  id: number;
  brand: string;
  model: string;
  category: string;
}

type RuleType = PricingRule['type'];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_COLORS: Record<RuleType, string> = {
  demand: 'bg-purple-100 text-purple-700',
  advance_booking: 'bg-blue-100 text-blue-700',
  duration: 'bg-green-100 text-green-700',
  last_minute: 'bg-orange-100 text-orange-700',
  event: 'bg-pink-100 text-pink-700',
};

const DEMAND_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Low: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  Medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' },
  High: { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  'Very High': { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
};

const EMPTY_FORM: Omit<PricingRule, 'id'> = {
  name: '',
  type: 'demand',
  car_id: null,
  category: null,
  multiplier: 1.0,
  conditions: {},
  priority: 0,
  is_active: true,
  start_date: null,
  end_date: null,
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminPricingPage() {
  const { t } = useLanguageStore();

  const RULE_TYPES: { value: RuleType; label: string }[] = [
    { value: 'demand', label: t.demand },
    { value: 'advance_booking', label: t.advanceBooking },
    { value: 'duration', label: t.durationLabel },
    { value: 'last_minute', label: t.lastMinute },
    { value: 'event', label: t.event },
  ];

  /* ---- state ---- */
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [demand, setDemand] = useState<DemandInfo | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<Omit<PricingRule, 'id'>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [conditionsText, setConditionsText] = useState('{}');
  const [conditionsError, setConditionsError] = useState('');

  // delete
  const [deleteTarget, setDeleteTarget] = useState<PricingRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  // calculator
  const [calcCarId, setCalcCarId] = useState('');
  const [calcPickup, setCalcPickup] = useState('');
  const [calcDropoff, setCalcDropoff] = useState('');
  const [calcResult, setCalcResult] = useState<PriceBreakdown | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState('');

  /* ---- data fetching ---- */
  const fetchRules = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/pricing/rules');
      setRules(data.rules);
    } catch (err) {
      console.error('Failed to fetch pricing rules:', err);
    }
  }, []);

  const fetchDemand = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/pricing/demand');
      setDemand(data);
    } catch (err) {
      console.error('Failed to fetch demand info:', err);
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchRules(), fetchDemand(), fetchCars()]);
      setLoading(false);
    };
    load();
  }, [fetchRules, fetchDemand, fetchCars]);

  /* ---- modal helpers ---- */
  const openCreate = () => {
    setEditingRule(null);
    setForm({ ...EMPTY_FORM });
    setConditionsText('{}');
    setConditionsError('');
    setModalOpen(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      type: rule.type,
      car_id: rule.car_id,
      category: rule.category,
      multiplier: rule.multiplier,
      conditions: rule.conditions,
      priority: rule.priority,
      is_active: rule.is_active,
      start_date: rule.start_date,
      end_date: rule.end_date,
    });
    setConditionsText(JSON.stringify(rule.conditions, null, 2));
    setConditionsError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    // validate conditions JSON
    let parsedConditions: Record<string, unknown>;
    try {
      parsedConditions = JSON.parse(conditionsText);
    } catch {
      setConditionsError('Invalid JSON');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, conditions: parsedConditions };
      if (editingRule) {
        await api.put(`/admin/pricing/rules/${editingRule.id}`, payload);
      } else {
        await api.post('/admin/pricing/rules', payload);
      }
      setModalOpen(false);
      await fetchRules();
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- toggle active ---- */
  const toggleActive = async (rule: PricingRule) => {
    try {
      await api.put(`/admin/pricing/rules/${rule.id}`, {
        ...rule,
        is_active: !rule.is_active,
      });
      await fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  /* ---- delete ---- */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/pricing/rules/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    } finally {
      setDeleting(false);
    }
  };

  /* ---- calculator ---- */
  const handleCalculate = async () => {
    if (!calcCarId || !calcPickup || !calcDropoff) return;
    setCalcLoading(true);
    setCalcError('');
    setCalcResult(null);
    try {
      const { data } = await api.get(
        `/admin/pricing/calculate?car_id=${calcCarId}&pickup_date=${calcPickup}&dropoff_date=${calcDropoff}`,
      );
      setCalcResult(data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Calculation failed';
      setCalcError(message);
    } finally {
      setCalcLoading(false);
    }
  };

  /* ---- demand level color helper ---- */
  const demandStyle = DEMAND_COLORS[demand?.level ?? 'Low'] ?? DEMAND_COLORS.Low;

  /* ---------------------------------------------------------------- */
  /*  Loading skeleton                                                 */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.dynamicPricing}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
              <div className="h-8 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.dynamicPricing}</h1>
          {demand && (
            <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', demandStyle.bg, demandStyle.text)}>
              {demand.level === 'Low' ? t.lowDemand : demand.level === 'Medium' ? t.mediumDemand : demand.level === 'High' ? t.highDemand : t.veryHighDemand}
            </span>
          )}
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e6432a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addRule}
        </button>
      </div>

      {/* ---- Demand overview card ---- */}
      {demand && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 font-outfit">{t.demandOverview}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* demand bar */}
            <div className="sm:col-span-1">
              <p className="text-sm text-gray-500 mb-1">{t.currentDemand}</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">{demand.demand_percent}%</p>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', demandStyle.bar)}
                  style={{ width: `${Math.min(demand.demand_percent, 100)}%` }}
                />
              </div>
            </div>
            {/* active reservations */}
            <div>
              <p className="text-sm text-gray-500 mb-1">{t.activeReservations}</p>
              <p className="text-2xl font-bold text-gray-900">{demand.active_reservations}</p>
            </div>
            {/* total cars */}
            <div>
              <p className="text-sm text-gray-500 mb-1">{t.totalCarsCount}</p>
              <p className="text-2xl font-bold text-gray-900">{demand.total_cars}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Pricing Rules ---- */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 font-outfit">{t.pricingRules}</h2>
          <span className="text-sm text-gray-400">({rules.length})</span>
        </div>

        {rules.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Gauge className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">{t.noPricingRules}</p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e6432a] transition-colors"
            >
              <Plus className="w-4 h-4" /> {t.createFirstRule}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'bg-white rounded-xl border border-gray-100 p-5 transition-opacity',
                  !rule.is_active && 'opacity-60',
                )}
              >
                {/* top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', TYPE_COLORS[rule.type])}>
                        {RULE_TYPES.find((t) => t.value === rule.type)?.label ?? rule.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {t.priority}: {rule.priority}
                      {rule.car_id ? ` · Car #${rule.car_id}` : ''}
                      {rule.category ? ` · ${rule.category}` : ''}
                    </p>
                  </div>
                  <span className="text-xl font-bold text-[#FF4D30] whitespace-nowrap">{rule.multiplier}x</span>
                </div>

                {/* conditions */}
                {Object.keys(rule.conditions ?? {}).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{t.conditions}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(rule.conditions).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-0.5 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600"
                        >
                          {key}: {String(val)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* date range */}
                {(rule.start_date || rule.end_date) && (
                  <p className="text-xs text-gray-400 mb-3">
                    {rule.start_date ? formatDate(rule.start_date) : '...'} &ndash;{' '}
                    {rule.end_date ? formatDate(rule.end_date) : '...'}
                  </p>
                )}

                {/* actions row */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  {/* active toggle */}
                  <button
                    onClick={() => toggleActive(rule)}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        rule.is_active ? 'bg-[#FF4D30]' : 'bg-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                          rule.is_active ? 'translate-x-4' : 'translate-x-1',
                        )}
                      />
                    </span>
                    <span className={rule.is_active ? 'text-gray-700' : 'text-gray-400'}>
                      {rule.is_active ? t.active : t.inactive}
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(rule)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Price Calculator ---- */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 font-outfit">{t.priceCalculator}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          {/* car select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.car}</label>
            <div className="relative">
              <select
                value={calcCarId}
                onChange={(e) => setCalcCarId(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] pr-8"
              >
                <option value="">{t.selectCarLabel}</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand} {c.model}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* pickup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.pickupDate}</label>
            <input
              type="date"
              value={calcPickup}
              onChange={(e) => setCalcPickup(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
            />
          </div>

          {/* dropoff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.returnDate}</label>
            <input
              type="date"
              value={calcDropoff}
              onChange={(e) => setCalcDropoff(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
            />
          </div>

          {/* button */}
          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={calcLoading || !calcCarId || !calcPickup || !calcDropoff}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e6432a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calcLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              {t.calculatePrice}
            </button>
          </div>
        </div>

        {calcError && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 mb-4">
            {calcError}
          </div>
        )}

        {calcResult && (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 bg-gray-50">
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">{t.dailyRate}</p>
                <p className="text-lg font-bold text-gray-900">&euro;{calcResult.daily_rate.toFixed(2)}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">{t.seasonalMultiplier}</p>
                <p className="text-lg font-bold text-gray-900">{calcResult.seasonal_multiplier}x</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">{t.dynamicMultiplier}</p>
                <p className="text-lg font-bold text-gray-900">{calcResult.dynamic_multiplier}x</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">{t.finalDailyRate}</p>
                <p className="text-lg font-bold text-[#FF4D30]">&euro;{calcResult.final_daily_rate.toFixed(2)}</p>
              </div>
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{calcResult.total_days} day{calcResult.total_days !== 1 ? 's' : ''}</span>
                <span>{t.demand}: {calcResult.demand_percent}%</span>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {t.total}: <span className="text-[#FF4D30]">&euro;{calcResult.total_price.toFixed(2)}</span>
              </p>
            </div>
            {calcResult.applied_rules.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t.appliedRules}</p>
                <div className="flex flex-wrap gap-2">
                  {calcResult.applied_rules.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-full text-xs font-medium text-purple-700"
                    >
                      {r.name} ({r.multiplier}x)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  Add / Edit Rule Modal                                           */}
      {/* ================================================================ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 font-outfit">
                {editingRule ? 'Edit Rule' : 'New Pricing Rule'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* body */}
            <div className="px-6 py-4 space-y-4">
              {/* name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.name}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. High-Demand Surge"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {/* type + multiplier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.type}</label>
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as RuleType })}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] pr-8"
                    >
                      {RULE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.multiplier}
                    onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* priority + active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.priority}</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_active: !form.is_active })}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        form.is_active ? 'bg-[#FF4D30]' : 'bg-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                          form.is_active ? 'translate-x-6' : 'translate-x-1',
                        )}
                      />
                    </button>
                    <span className="text-sm text-gray-700">{t.active}</span>
                  </label>
                </div>
              </div>

              {/* car / category filter */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.car} {t.optional}</label>
                  <div className="relative">
                    <select
                      value={form.car_id ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, car_id: e.target.value ? Number(e.target.value) : null })
                      }
                      className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] pr-8"
                    >
                      <option value="">All cars</option>
                      {cars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.brand} {c.model}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                  <input
                    type="text"
                    value={form.category ?? ''}
                    onChange={(e) => setForm({ ...form, category: e.target.value || null })}
                    placeholder="e.g. SUV"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (optional)</label>
                  <input
                    type="date"
                    value={form.start_date ?? ''}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={form.end_date ?? ''}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* conditions JSON */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.conditions} <span className="text-gray-400 font-normal">(JSON)</span>
                </label>
                <textarea
                  rows={4}
                  value={conditionsText}
                  onChange={(e) => {
                    setConditionsText(e.target.value);
                    setConditionsError('');
                  }}
                  placeholder='{"min_demand_percent": 70}'
                  className={cn(
                    'w-full bg-white border rounded-lg px-3 py-2.5 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]',
                    conditionsError ? 'border-red-400' : 'border-gray-200',
                  )}
                />
                {conditionsError && <p className="mt-1 text-xs text-red-500">{conditionsError}</p>}
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="px-4 py-2 text-sm font-medium text-white bg-[#FF4D30] rounded-lg hover:bg-[#e6432a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t.saving : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  Delete Confirmation Modal                                       */}
      {/* ================================================================ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.delete}</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? t.deleting : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
