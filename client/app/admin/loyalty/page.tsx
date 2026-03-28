'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguageStore } from '@/stores/languageStore';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import { Award, Users, Plus, Edit, Trash2, Gift, Crown, Star, X, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoyaltyAccount {
  id: string;
  user_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  type: string;
  description: string;
  created_at: string;
}

interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  type: 'discount_percent' | 'discount_fixed' | 'free_day' | 'upgrade' | 'free_extra';
  value: number;
  points_cost: number;
  is_active: boolean;
  min_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface LoyaltyConfig {
  points_per_euro: number;
  tier_thresholds: Record<string, number>;
  [key: string]: unknown;
}

type Tab = 'members' | 'rewards' | 'settings';
type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<Tier, { bg: string; text: string; hex: string }> = {
  bronze:   { bg: 'bg-[#CD7F32]/15', text: 'text-[#8B5521]', hex: '#CD7F32' },
  silver:   { bg: 'bg-[#C0C0C0]/20', text: 'text-[#555555]', hex: '#C0C0C0' },
  gold:     { bg: 'bg-[#FFD700]/15', text: 'text-[#8B7500]', hex: '#FFD700' },
  platinum: { bg: 'bg-[#E5E4E2]/25', text: 'text-[#444444]', hex: '#E5E4E2' },
};

const TIER_OPTIONS: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { tier: Tier }) {
  const style = TIER_COLORS[tier];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize', style.bg, style.text)}>
      {tier === 'gold' || tier === 'platinum' ? <Crown className="w-3 h-3" /> : <Star className="w-3 h-3" />}
      {tier}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminLoyaltyPage() {
  const { t } = useLanguageStore();

  const REWARD_TYPE_LABELS: Record<string, string> = {
    discount_percent: t.discountPercent,
    discount_fixed: t.fixedDiscount,
    free_day: t.freeDay,
    upgrade: t.upgrade,
    free_extra: t.freeExtra,
  };

  const [tab, setTab] = useState<Tab>('members');

  // Stats
  const [stats, setStats] = useState({ total: 0, pointsIssued: 0, bronze: 0, silver: 0, gold: 0, platinum: 0 });

  // Members
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [accountsPage, setAccountsPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<Tier | ''>('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Member detail panel
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [adjustForm, setAdjustForm] = useState({ points: '', type: 'bonus' as 'bonus' | 'adjust' | 'expire', description: '' });
  const [adjusting, setAdjusting] = useState(false);

  // Rewards
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [rewardModal, setRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rewardForm, setRewardForm] = useState({ name: '', description: '', type: 'discount_percent', value: '', points_cost: '', is_active: true, min_tier: 'bronze' as Tier });
  const [savingReward, setSavingReward] = useState(false);

  // Redeem reward
  const [redeeming, setRedeeming] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState('');

  // Config
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const LIMIT = 15;

  // ---- Fetch accounts ----
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const params = new URLSearchParams();
      if (tierFilter) params.set('tier', tierFilter);
      params.set('page', String(accountsPage));
      params.set('limit', String(LIMIT));
      const { data } = await api.get(`/admin/loyalty/accounts?${params}`);
      setAccounts(data.accounts);
      setAccountsTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch loyalty accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  }, [tierFilter, accountsPage]);

  // ---- Derive stats from first load (no filter) ----
  const fetchStats = useCallback(async () => {
    try {
      const tiers: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];
      const results = await Promise.all([
        api.get('/admin/loyalty/accounts?page=1&limit=1'),
        ...tiers.map(t => api.get(`/admin/loyalty/accounts?tier=${t}&page=1&limit=1`)),
      ]);
      const total = results[0].data.total ?? 0;
      const bronze = results[1].data.total ?? 0;
      const silver = results[2].data.total ?? 0;
      const gold = results[3].data.total ?? 0;
      const platinum = results[4].data.total ?? 0;

      // Approximate lifetime points from the first batch
      const allRes = await api.get('/admin/loyalty/accounts?page=1&limit=100');
      const pointsIssued = (allRes.data.accounts as LoyaltyAccount[]).reduce(
        (sum: number, a: LoyaltyAccount) => sum + (a.lifetime_points ?? 0), 0,
      );

      setStats({ total, pointsIssued, bronze, silver, gold, platinum });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // ---- Fetch member detail ----
  const openMemberPanel = async (account: LoyaltyAccount) => {
    setSelectedAccount(account);
    setTransactions([]);
    setAdjustForm({ points: '', type: 'bonus', description: '' });
    try {
      const { data } = await api.get(`/admin/loyalty/accounts/${account.id}`);
      setSelectedAccount(data.account);
      setTransactions(data.transactions ?? []);
    } catch (err) {
      console.error('Failed to fetch account detail:', err);
    }
  };

  // ---- Adjust points ----
  const handleAdjust = async () => {
    if (!selectedAccount || !adjustForm.points || !adjustForm.description) return;
    setAdjusting(true);
    try {
      const { data } = await api.post(`/admin/loyalty/accounts/${selectedAccount.id}/adjust`, {
        points: Number(adjustForm.points),
        type: adjustForm.type,
        description: adjustForm.description,
      });
      setSelectedAccount(data.account);
      setAdjustForm({ points: '', type: 'bonus', description: '' });
      // Refresh transactions
      const detail = await api.get(`/admin/loyalty/accounts/${selectedAccount.id}`);
      setTransactions(detail.data.transactions ?? []);
      fetchAccounts();
    } catch (err) {
      console.error('Failed to adjust points:', err);
    } finally {
      setAdjusting(false);
    }
  };

  const handleRedeem = async () => {
    if (!selectedAccount || !selectedRewardId) return;
    const reward = rewards.find(r => r.id === selectedRewardId);
    if (!reward) return;
    if (selectedAccount.points_balance < reward.points_cost) return;
    setRedeeming(true);
    try {
      await api.post(`/admin/loyalty/accounts/${selectedAccount.id}/adjust`, {
        points: -reward.points_cost,
        type: 'redeem' as 'adjust',
        description: `Redeemed: ${reward.name} (${REWARD_TYPE_LABELS[reward.type]} — ${reward.value})`,
      });
      // Refresh account & transactions
      const detail = await api.get(`/admin/loyalty/accounts/${selectedAccount.id}`);
      setSelectedAccount(detail.data.account);
      setTransactions(detail.data.transactions ?? []);
      setSelectedRewardId('');
      fetchAccounts();
    } catch (err) {
      console.error('Failed to redeem reward:', err);
    } finally {
      setRedeeming(false);
    }
  };

  // ---- Fetch rewards ----
  const fetchRewards = useCallback(async () => {
    setLoadingRewards(true);
    try {
      const { data } = await api.get('/admin/loyalty/rewards');
      setRewards(data.rewards);
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    } finally {
      setLoadingRewards(false);
    }
  }, []);

  // ---- Save reward (create/update) ----
  const handleSaveReward = async () => {
    setSavingReward(true);
    try {
      const payload = {
        name: rewardForm.name,
        description: rewardForm.description,
        type: rewardForm.type,
        value: Number(rewardForm.value),
        points_cost: Number(rewardForm.points_cost),
        is_active: rewardForm.is_active,
        min_tier: rewardForm.min_tier,
      };
      if (editingReward) {
        await api.put(`/admin/loyalty/rewards/${editingReward.id}`, payload);
      } else {
        await api.post('/admin/loyalty/rewards', payload);
      }
      setRewardModal(false);
      setEditingReward(null);
      fetchRewards();
    } catch (err) {
      console.error('Failed to save reward:', err);
    } finally {
      setSavingReward(false);
    }
  };

  // ---- Delete reward ----
  const handleDeleteReward = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;
    try {
      await api.delete(`/admin/loyalty/rewards/${id}`);
      fetchRewards();
    } catch (err) {
      console.error('Failed to delete reward:', err);
    }
  };

  // ---- Toggle reward active ----
  const toggleRewardActive = async (reward: LoyaltyReward) => {
    try {
      await api.put(`/admin/loyalty/rewards/${reward.id}`, { ...reward, is_active: !reward.is_active });
      fetchRewards();
    } catch (err) {
      console.error('Failed to toggle reward:', err);
    }
  };

  // ---- Open reward form ----
  const openRewardForm = (reward?: LoyaltyReward) => {
    if (reward) {
      setEditingReward(reward);
      setRewardForm({
        name: reward.name,
        description: reward.description,
        type: reward.type,
        value: String(reward.value),
        points_cost: String(reward.points_cost),
        is_active: reward.is_active,
        min_tier: reward.min_tier,
      });
    } else {
      setEditingReward(null);
      setRewardForm({ name: '', description: '', type: 'discount_percent', value: '', points_cost: '', is_active: true, min_tier: 'bronze' });
    }
    setRewardModal(true);
  };

  // ---- Fetch config ----
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const { data } = await api.get('/admin/loyalty/config');
      setConfig(data.config);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // ---- Effects ----
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => {
    if (tab === 'rewards') fetchRewards();
    if (tab === 'settings') fetchConfig();
  }, [tab, fetchRewards, fetchConfig]);

  // ---- Pagination helpers ----
  const totalPages = Math.ceil(accountsTotal / LIMIT);

  // ---- Table columns ----
  const memberColumns = [
    {
      key: 'name',
      label: t.name,
      render: (a: LoyaltyAccount) => (
        <div>
          <p className="font-medium text-gray-900">{a.first_name} {a.last_name}</p>
          <p className="text-xs text-gray-500">{a.email}</p>
        </div>
      ),
    },
    { key: 'email', label: t.email, render: (a: LoyaltyAccount) => <span className="text-sm">{a.email}</span>, className: 'hidden lg:table-cell' },
    {
      key: 'tier',
      label: 'Tier',
      render: (a: LoyaltyAccount) => <TierBadge tier={a.tier} />,
    },
    {
      key: 'points_balance',
      label: t.pointsBalance,
      render: (a: LoyaltyAccount) => <span className="font-semibold text-gray-900">{a.points_balance.toLocaleString()}</span>,
    },
    {
      key: 'lifetime_points',
      label: t.lifetimePoints,
      render: (a: LoyaltyAccount) => <span className="text-sm text-gray-600">{a.lifetime_points.toLocaleString()}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (a: LoyaltyAccount) => (
        <button
          onClick={(e) => { e.stopPropagation(); openMemberPanel(a); }}
          className="text-[#FF4D30] hover:underline text-sm font-medium"
        >
          {t.view}
        </button>
      ),
    },
  ];

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit flex items-center gap-2">
          <Award className="w-7 h-7 text-[#FF4D30]" />
          {t.loyaltyProgram}
        </h1>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard icon={Users} label={t.totalMembers} value={stats.total} color="bg-[#FF4D30]" />
        <StatCard icon={Gift} label={t.pointsIssued} value={stats.pointsIssued} color="bg-indigo-500" />
        <StatCard icon={Star} label={t.bronze} value={stats.bronze} color="bg-[#CD7F32]" />
        <StatCard icon={Star} label={t.silver} value={stats.silver} color="bg-[#9E9E9E]" />
        <StatCard icon={Crown} label={t.gold} value={stats.gold} color="bg-[#DAA520]" />
        <StatCard icon={Crown} label={t.platinum} value={stats.platinum} color="bg-[#607D8B]" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([['members', t.members], ['rewards', t.rewardsLabel], ['settings', t.settings]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                tab === key ? 'border-[#FF4D30] text-[#FF4D30]' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ======================= MEMBERS TAB ======================= */}
      {tab === 'members' && (
        <div className="space-y-4">
          {/* Tier filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={tierFilter}
                onChange={e => { setTierFilter(e.target.value as Tier | ''); setAccountsPage(1); }}
                className="appearance-none pl-4 pr-9 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
              >
                <option value="">{t.all}</option>
                {TIER_OPTIONS.map(t => (
                  <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <DataTable
            columns={memberColumns as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode; className?: string }[]}
            data={accounts as unknown as Record<string, unknown>[]}
            loading={loadingAccounts}
            emptyMessage={t.noDataAvailable}
            onRowClick={(row) => openMemberPanel(row as unknown as LoyaltyAccount)}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((accountsPage - 1) * LIMIT) + 1}–{Math.min(accountsPage * LIMIT, accountsTotal)} of {accountsTotal}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={accountsPage <= 1}
                  onClick={() => setAccountsPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  {t.previous}
                </button>
                <button
                  disabled={accountsPage >= totalPages}
                  onClick={() => setAccountsPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================= REWARDS TAB ======================= */}
      {tab === 'rewards' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openRewardForm()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e6432a] transition-colors"
            >
              <Plus className="w-4 h-4" /> {t.newReward}
            </button>
          </div>

          {loadingRewards ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-3">
                  <div className="h-5 bg-gray-100 rounded w-2/3" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : rewards.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{t.noDataAvailable}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rewards.map(reward => (
                <div key={reward.id} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{reward.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <button onClick={() => openRewardForm(reward)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteReward(reward.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 font-medium">{REWARD_TYPE_LABELS[reward.type] ?? reward.type}</span>
                    <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 font-medium">Value: {reward.value}</span>
                    <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 font-medium">{reward.points_cost.toLocaleString()} pts</span>
                    <TierBadge tier={reward.min_tier} />
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-500">{t.active}</span>
                    <button
                      onClick={() => toggleRewardActive(reward)}
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-colors',
                        reward.is_active ? 'bg-[#FF4D30]' : 'bg-gray-300',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        reward.is_active && 'translate-x-5',
                      )} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================= SETTINGS TAB ======================= */}
      {tab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          {loadingConfig ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-gray-100 rounded w-1/2" />)}
            </div>
          ) : config ? (
            <>
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900 text-lg">Earning Rules</h2>
                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t.pointsPerEuro}</p>
                    <p className="text-xs text-gray-400">Points earned for every 1 EUR spent</p>
                  </div>
                  <span className="text-lg font-bold text-[#FF4D30]">{config.points_per_euro}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900 text-lg">{t.tierThresholds}</h2>
                <p className="text-sm text-gray-500">Lifetime points required to reach each tier</p>
                <div className="space-y-3">
                  {TIER_OPTIONS.map(tier => {
                    const threshold = config.tier_thresholds?.[tier] ?? '—';
                    return (
                      <div key={tier} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                        <TierBadge tier={tier} />
                        <span className="text-sm font-semibold text-gray-700">{typeof threshold === 'number' ? threshold.toLocaleString() : threshold} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm">Unable to load configuration</p>
            </div>
          )}
        </div>
      )}

      {/* ======================= MEMBER DETAIL PANEL ======================= */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedAccount(null)}>
          <div
            className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {selectedAccount.first_name} {selectedAccount.last_name}
              </h2>
              <button onClick={() => setSelectedAccount(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Account info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{t.email}</p>
                  <p className="font-medium text-gray-900">{selectedAccount.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tier</p>
                  <div className="mt-1"><TierBadge tier={selectedAccount.tier} /></div>
                </div>
                <div>
                  <p className="text-gray-500">{t.pointsBalance}</p>
                  <p className="text-xl font-bold text-[#FF4D30]">{selectedAccount.points_balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.lifetimePoints}</p>
                  <p className="text-xl font-bold text-gray-900">{selectedAccount.lifetime_points.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.memberSince}</p>
                  <p className="font-medium">{formatDate(selectedAccount.created_at)}</p>
                </div>
              </div>

              {/* Adjust Points */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="font-semibold text-gray-900 mb-3">{t.adjustPoints}</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t.amount}</label>
                      <input
                        type="number"
                        value={adjustForm.points}
                        onChange={e => setAdjustForm(f => ({ ...f, points: e.target.value }))}
                        placeholder="e.g. 500 or -100"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t.type}</label>
                      <select
                        value={adjustForm.type}
                        onChange={e => setAdjustForm(f => ({ ...f, type: e.target.value as 'bonus' | 'adjust' | 'expire' }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                      >
                        <option value="bonus">{t.bonus}</option>
                        <option value="adjust">{t.adjust}</option>
                        <option value="expire">{t.expire}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t.description}</label>
                    <input
                      type="text"
                      value={adjustForm.description}
                      onChange={e => setAdjustForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Reason for adjustment..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                    />
                  </div>
                  <button
                    onClick={handleAdjust}
                    disabled={adjusting || !adjustForm.points || !adjustForm.description}
                    className="w-full py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e6432a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adjusting ? t.saving : t.adjustPoints}
                  </button>
                </div>
              </div>

              {/* Redeem Reward */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Gift className="w-4 h-4 text-[#FF4D30]" /> {t.redeemReward}</h3>
                {rewards.filter(r => r.is_active).length === 0 ? (
                  <p className="text-sm text-gray-400">{t.noDataAvailable}</p>
                ) : (
                  <div className="space-y-3">
                    <select
                      value={selectedRewardId}
                      onChange={e => setSelectedRewardId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                    >
                      <option value="">{t.selectReward}</option>
                      {rewards.filter(r => r.is_active).map(r => (
                        <option key={r.id} value={r.id} disabled={selectedAccount!.points_balance < r.points_cost}>
                          {r.name} — {r.points_cost} pts {selectedAccount!.points_balance < r.points_cost ? '(not enough points)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedRewardId && (() => {
                      const r = rewards.find(rw => rw.id === selectedRewardId);
                      if (!r) return null;
                      return (
                        <div className="bg-gray-50 rounded-lg p-3 text-sm">
                          <p className="font-medium text-gray-900">{r.name}</p>
                          <p className="text-gray-500">{r.description}</p>
                          <p className="mt-1 text-xs text-gray-400">{REWARD_TYPE_LABELS[r.type]}: {r.value} &middot; Cost: <span className="font-bold text-[#FF4D30]">{r.points_cost} pts</span></p>
                        </div>
                      );
                    })()}
                    <button
                      onClick={handleRedeem}
                      disabled={redeeming || !selectedRewardId || (selectedAccount!.points_balance < (rewards.find(r => r.id === selectedRewardId)?.points_cost ?? Infinity))}
                      className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {redeeming ? t.saving : t.redeemReward}
                    </button>
                  </div>
                )}
              </div>

              {/* Transaction History */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="font-semibold text-gray-900 mb-3">Transaction History</h3>
                {transactions.length === 0 ? (
                  <p className="text-sm text-gray-400">{t.noDataAvailable}</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{tx.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(tx.created_at)} &middot; <span className="capitalize">{tx.type}</span></p>
                        </div>
                        <span className={cn('font-bold', tx.points >= 0 ? 'text-green-600' : 'text-red-500')}>
                          {tx.points >= 0 ? '+' : ''}{tx.points.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= REWARD ADD/EDIT MODAL ======================= */}
      {rewardModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setRewardModal(false); setEditingReward(null); }}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingReward ? t.edit + ' Reward' : t.newReward}</h2>
              <button onClick={() => { setRewardModal(false); setEditingReward(null); }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t.name}</label>
                <input
                  type="text"
                  value={rewardForm.name}
                  onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  placeholder="Reward name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t.description}</label>
                <textarea
                  value={rewardForm.description}
                  onChange={e => setRewardForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                  placeholder="Describe the reward"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.type}</label>
                  <select
                    value={rewardForm.type}
                    onChange={e => setRewardForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  >
                    {Object.entries(REWARD_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
                  <input
                    type="number"
                    value={rewardForm.value}
                    onChange={e => setRewardForm(f => ({ ...f, value: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                    placeholder="e.g. 10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.pointsCost}</label>
                  <input
                    type="number"
                    value={rewardForm.points_cost}
                    onChange={e => setRewardForm(f => ({ ...f, points_cost: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.minimumTier}</label>
                  <select
                    value={rewardForm.min_tier}
                    onChange={e => setRewardForm(f => ({ ...f, min_tier: e.target.value as Tier }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  >
                    {TIER_OPTIONS.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 font-medium">{t.active}</label>
                <button
                  type="button"
                  onClick={() => setRewardForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    rewardForm.is_active ? 'bg-[#FF4D30]' : 'bg-gray-300',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    rewardForm.is_active && 'translate-x-5',
                  )} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setRewardModal(false); setEditingReward(null); }}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleSaveReward}
                  disabled={savingReward || !rewardForm.name || !rewardForm.value || !rewardForm.points_cost}
                  className="flex-1 py-2.5 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#e6432a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingReward ? t.saving : editingReward ? t.save : t.create}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
