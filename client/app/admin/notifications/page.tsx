'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useLanguageStore } from '@/stores/languageStore';
import { formatDateTime, cn } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import { MessageSquare, Send, Edit, Eye, Check, X, ExternalLink, Phone } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationTemplate {
  id: string;
  type: string;
  channel: string;
  template_name: string;
  template_body: string;
  is_active: boolean;
}

interface NotificationLog {
  id: string;
  reservation_id: string;
  user_id: string;
  type: string;
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  customer_name: string;
  reservation_no: string;
}

interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface SendResult {
  success: boolean;
  message: string;
  whatsapp_url?: string;
  log_id?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = 'log' | 'templates' | 'send';

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  delivered: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  read: 'bg-purple-100 text-purple-700',
};

const NOTIFICATION_TYPES = [
  { label: 'Booking Confirmation', value: 'booking_confirmation' },
  { label: 'Pickup Reminder', value: 'pickup_reminder' },
  { label: 'Return Reminder', value: 'return_reminder' },
  { label: 'Review Request', value: 'review_request' },
  { label: 'Status Change', value: 'status_change' },
];

const TEMPLATE_VARIABLES = [
  '{{customer_name}}',
  '{{reservation_no}}',
  '{{car_name}}',
  '{{pickup_date}}',
  '{{dropoff_date}}',
  '{{total_price}}',
  '{{status}}',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminNotificationsPage() {
  const { t } = useLanguageStore();

  const TABS = [
    { key: 'log' as const, label: t.notificationLog },
    { key: 'templates' as const, label: t.templates },
    { key: 'send' as const, label: t.sendManual },
  ];

  const STATUS_FILTERS = [
    { label: t.all, value: 'all' },
    { label: 'Sent', value: 'sent' },
    { label: t.delivered, value: 'delivered' },
    { label: t.failed, value: 'failed' },
    { label: t.pending, value: 'pending' },
  ];

  const [activeTab, setActiveTab] = useState<TabKey>('log');

  // Stats
  const [stats, setStats] = useState<NotificationStats>({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Log tab
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logStatus, setLogStatus] = useState('all');
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  // Templates tab
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editActive, setEditActive] = useState(false);
  const [saving, setSaving] = useState(false);

  // Send manual tab
  const [sendPhone, setSendPhone] = useState('');
  const [sendType, setSendType] = useState('booking_confirmation');
  const [sendReservationId, setSendReservationId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState('');

  // ---------------------------------------------------------------------------
  // Fetchers
  // ---------------------------------------------------------------------------

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/notifications/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(logPage));
      params.set('limit', '20');
      if (logStatus !== 'all') params.set('status', logStatus);
      const { data } = await api.get(`/admin/notifications/log?${params}`);
      setLogs(data.notifications);
      setLogTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logPage, logStatus]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const { data } = await api.get('/admin/notifications/templates');
      setTemplates(data.templates);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'log') fetchLogs();
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab === 'templates') fetchTemplates();
  }, [activeTab, fetchTemplates]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      await api.put(`/admin/notifications/templates/${editingTemplate.id}`, {
        template_body: editBody,
        is_active: editActive,
      });
      setTemplates(prev =>
        prev.map(t =>
          t.id === editingTemplate.id ? { ...t, template_body: editBody, is_active: editActive } : t,
        ),
      );
      setEditingTemplate(null);
    } catch (err) {
      console.error('Failed to update template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');
    setSendResult(null);

    if (!sendPhone.trim()) {
      setSendError('Phone number is required');
      return;
    }

    setSending(true);
    try {
      const { data } = await api.post('/admin/notifications/send', {
        recipient: sendPhone.trim(),
        type: sendType,
        reservation_id: sendReservationId.trim() || undefined,
      });
      setSendResult(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { error: string } } }).response?.data?.error
          : 'Failed to send notification';
      setSendError(msg || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Log table columns
  // ---------------------------------------------------------------------------

  const logColumns = [
    {
      key: 'recipient',
      label: t.recipient,
      render: (row: NotificationLog) => (
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-xs">{row.recipient}</span>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: t.customer,
      render: (row: NotificationLog) => (
        <span className="font-medium text-gray-900">{row.customer_name || 'N/A'}</span>
      ),
    },
    {
      key: 'reservation_no',
      label: t.reservationNum,
      render: (row: NotificationLog) => (
        <span className="font-mono text-xs text-gray-700">{row.reservation_no || '-'}</span>
      ),
    },
    {
      key: 'type',
      label: t.type,
      render: (row: NotificationLog) => (
        <span className="text-xs capitalize">{row.type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'status',
      label: t.status,
      render: (row: NotificationLog) => (
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
            STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-700',
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'sent_at',
      label: t.sentAt,
      render: (row: NotificationLog) => (
        <span className="text-xs text-gray-500">
          {row.sent_at ? formatDateTime(row.sent_at) : '-'}
        </span>
      ),
    },
  ];

  const logTotalPages = Math.ceil(logTotal / 20);

  // ---------------------------------------------------------------------------
  // Stats cards
  // ---------------------------------------------------------------------------

  const statsCards = [
    { label: t.totalSent, value: stats.total, icon: MessageSquare, color: 'text-gray-700', bg: 'bg-gray-50' },
    { label: t.delivered, value: stats.sent, icon: Check, color: 'text-green-600', bg: 'bg-green-50' },
    { label: t.failed, value: stats.failed, icon: X, color: 'text-red-600', bg: 'bg-red-50' },
    { label: t.pending, value: stats.pending, icon: Eye, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#25D366]/10 rounded-lg">
          <MessageSquare className="w-6 h-6 text-[#25D366]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.whatsappNotifications}</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={cn('p-3 rounded-lg', card.bg)}>
              <card.icon className={cn('w-5 h-5', card.color)} />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              )}
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB: Notification Log                                              */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => {
                  setLogStatus(f.value);
                  setLogPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  logStatus === f.value
                    ? 'bg-[#FF4D30] text-white border-[#FF4D30]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <DataTable
            columns={
              logColumns as {
                key: string;
                label: string;
                render?: (row: Record<string, unknown>) => React.ReactNode;
              }[]
            }
            data={logs as unknown as Record<string, unknown>[]}
            loading={logsLoading}
            emptyMessage={t.noNotificationsFound}
          />

          {/* Pagination */}
          {logTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(logPage - 1) * 20 + 1}&ndash;{Math.min(logPage * 20, logTotal)} of{' '}
                {logTotal}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogPage(p => Math.max(1, p - 1))}
                  disabled={logPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  {t.prev}
                </button>
                <button
                  onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))}
                  disabled={logPage === logTotalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB: Templates                                                     */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
                  <div className="h-5 w-40 bg-gray-100 rounded mb-3" />
                  <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-50 rounded" />
                    <div className="h-3 w-3/4 bg-gray-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">{t.noTemplatesFound}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.template_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs capitalize text-gray-500">
                          {template.type.replace(/_/g, ' ')}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#25D366]/10 text-[#25D366]">
                          {template.channel}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          template.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {template.is_active ? t.active : t.inactive}
                      </span>
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setEditBody(template.template_body);
                          setEditActive(template.is_active);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit template"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-line">
                    {template.template_body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Template edit modal */}
      {editingTemplate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingTemplate(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{t.editTemplate}</h2>
              <button
                onClick={() => setEditingTemplate(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.templateName}
                </label>
                <p className="text-sm text-gray-900">{editingTemplate.template_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.templateBody}
                </label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.availableVariables}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEditBody(prev => prev + v)}
                      className="px-2 py-1 bg-gray-100 text-xs font-mono text-gray-600 rounded hover:bg-gray-200 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{t.active}</label>
                <button
                  type="button"
                  onClick={() => setEditActive(prev => !prev)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    editActive ? 'bg-[#25D366]' : 'bg-gray-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      editActive ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#FF4D30] rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
                >
                  {saving ? t.saving : t.saveChanges}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB: Send Manual                                                   */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'send' && (
        <div className="max-w-xl space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-[#25D366]" />
              {t.sendWhatsappNotification}
            </h2>

            <form onSubmit={handleSendManual} className="space-y-4">
              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.phoneNumber} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={sendPhone}
                    onChange={e => setSendPhone(e.target.value)}
                    placeholder="+49 171 1234567"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                  />
                </div>
              </div>

              {/* Notification type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.notificationType}
                </label>
                <select
                  value={sendType}
                  onChange={e => setSendType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                >
                  {NOTIFICATION_TYPES.map(nt => (
                    <option key={nt.value} value={nt.value}>
                      {nt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reservation ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.reservationId} <span className="text-gray-400 font-normal">({t.optional})</span>
                </label>
                <input
                  type="text"
                  value={sendReservationId}
                  onChange={e => setSendReservationId(e.target.value)}
                  placeholder="e.g. abc123..."
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]"
                />
              </div>

              {sendError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                  <X className="w-4 h-4 flex-shrink-0" />
                  {sendError}
                </div>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-lg hover:bg-[#20bd5a] transition-colors disabled:opacity-50"
              >
                {sending ? (
                  t.sending
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t.sendNotification}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Send result */}
          {sendResult && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                {sendResult.success ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
                <p
                  className={cn(
                    'text-sm font-medium',
                    sendResult.success ? 'text-green-700' : 'text-red-700',
                  )}
                >
                  {sendResult.message}
                </p>
              </div>

              {sendResult.whatsapp_url && (
                <a
                  href={sendResult.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-lg hover:bg-[#20bd5a] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t.openWhatsapp}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
