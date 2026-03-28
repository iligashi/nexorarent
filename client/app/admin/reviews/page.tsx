'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import AdminBadge from '@/components/admin/AdminBadge';
import { Star, Check, X, MessageSquare, Trash2, Eye } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

interface Review {
  id: string;
  car_id: string;
  user_id: string;
  reservation_id: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  car_brand: string;
  car_model: string;
  first_name: string;
  last_name: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'w-4 h-4',
            i <= rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'
          )}
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { t } = useLanguageStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Reply modal state
  const [replyModal, setReplyModal] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // Detail modal state
  const [detailModal, setDetailModal] = useState<Review | null>(null);

  // Delete confirmation state
  const [deleteModal, setDeleteModal] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 20;

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const { data } = await api.get(`/admin/reviews?${params}`);
      setReviews(data.reviews);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        api.get('/admin/reviews?limit=1'),
        api.get('/admin/reviews?status=pending&limit=1'),
        api.get('/admin/reviews?status=approved&limit=1'),
        api.get('/admin/reviews?status=rejected&limit=1'),
      ]);
      setStats({
        total: allRes.data.total,
        pending: pendingRes.data.total,
        approved: approvedRes.data.total,
        rejected: rejectedRes.data.total,
      });
    } catch (err) {
      console.error('Failed to fetch review stats:', err);
    }
  };

  useEffect(() => { fetchReviews(); }, [statusFilter, page]);
  useEffect(() => { fetchStats(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/admin/reviews/${id}/approve`);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
      setStats(prev => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        approved: prev.approved + 1,
      }));
    } catch (err) {
      console.error('Failed to approve review:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.put(`/admin/reviews/${id}/reject`);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r));
      setStats(prev => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        rejected: prev.rejected + 1,
      }));
    } catch (err) {
      console.error('Failed to reject review:', err);
    }
  };

  const handleReply = async () => {
    if (!replyModal || !replyText.trim()) return;
    setReplying(true);
    try {
      const { data } = await api.put(`/admin/reviews/${replyModal.id}/reply`, { reply: replyText.trim() });
      setReviews(prev => prev.map(r => r.id === replyModal.id ? { ...r, admin_reply: data.review.admin_reply, replied_at: data.review.replied_at } : r));
      setReplyModal(null);
      setReplyText('');
    } catch (err) {
      console.error('Failed to reply to review:', err);
    } finally {
      setReplying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/reviews/${deleteModal.id}`);
      setReviews(prev => prev.filter(r => r.id !== deleteModal.id));
      setTotal(prev => prev - 1);
      const deletedStatus = deleteModal.status;
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        [deletedStatus]: Math.max(0, prev[deletedStatus] - 1),
      }));
      setDeleteModal(null);
    } catch (err) {
      console.error('Failed to delete review:', err);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'customer',
      label: t.customer,
      render: (r: Review) => (
        <p className="font-medium text-gray-900">{r.first_name} {r.last_name}</p>
      ),
    },
    {
      key: 'car',
      label: t.car,
      render: (r: Review) => (
        <span className="text-sm text-gray-700">{r.car_brand} {r.car_model}</span>
      ),
    },
    {
      key: 'rating',
      label: t.rating,
      render: (r: Review) => <StarRating rating={r.rating} />,
    },
    {
      key: 'comment',
      label: t.comment,
      render: (r: Review) => (
        <p className="text-sm text-gray-600 max-w-xs truncate" title={r.comment}>
          {r.comment}
        </p>
      ),
    },
    {
      key: 'status',
      label: t.status,
      render: (r: Review) => <AdminBadge status={r.status} />,
    },
    {
      key: 'created_at',
      label: t.date,
      render: (r: Review) => (
        <span className="text-sm text-gray-500">{formatDate(r.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: Review) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setDetailModal(r)}
            title="View details"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {r.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(r.id)}
                title="Approve"
                className="p-1.5 rounded-lg text-green-500 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleReject(r.id)}
                title="Reject"
                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => { setReplyModal(r); setReplyText(r.admin_reply || ''); }}
            title="Reply"
            className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteModal(r)}
            title="Delete"
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / limit);

  const statCards = [
    { label: t.totalReviews, value: stats.total, color: 'bg-gray-50 text-gray-700' },
    { label: t.pending, value: stats.pending, color: 'bg-amber-50 text-amber-700' },
    { label: t.approved, value: stats.approved, color: 'bg-green-50 text-green-700' },
    { label: t.rejected, value: stats.rejected, color: 'bg-red-50 text-red-700' },
  ];

  const statusTabs: { label: string; value: string }[] = [
    { label: t.all, value: 'all' },
    { label: t.pending, value: 'pending' },
    { label: t.approved, value: 'approved' },
    { label: t.rejected, value: 'rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.reviewsTitle}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={cn('text-2xl font-bold mt-1', card.color.split(' ')[1])}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]}
        data={reviews as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage={t.noDataAvailable}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              {t.prev}
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              {t.next}
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{t.reviewDetails}</h2>
              <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <AdminBadge status={detailModal.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{t.customer}</p>
                  <p className="font-medium text-gray-900">{detailModal.first_name} {detailModal.last_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.car}</p>
                  <p className="font-medium text-gray-900">{detailModal.car_brand} {detailModal.car_model}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.rating}</p>
                  <StarRating rating={detailModal.rating} />
                </div>
                <div>
                  <p className="text-gray-500">{t.date}</p>
                  <p className="font-medium text-gray-900">{formatDate(detailModal.created_at)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">{t.comment}</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{detailModal.comment}</p>
              </div>
              {detailModal.admin_reply && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t.adminReply}</p>
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{detailModal.admin_reply}</p>
                  {detailModal.replied_at && (
                    <p className="text-xs text-gray-400 mt-1">{t.repliedOn} {formatDate(detailModal.replied_at)}</p>
                  )}
                </div>
              )}
              {/* Actions */}
              <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2">
                {detailModal.status === 'pending' && (
                  <>
                    <button
                      onClick={() => { handleApprove(detailModal.id); setDetailModal(prev => prev ? { ...prev, status: 'approved' } : null); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <Check className="w-4 h-4" /> {t.approve}
                    </button>
                    <button
                      onClick={() => { handleReject(detailModal.id); setDetailModal(prev => prev ? { ...prev, status: 'rejected' } : null); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" /> {t.reject}
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setReplyModal(detailModal); setReplyText(detailModal.admin_reply || ''); setDetailModal(null); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" /> {detailModal.admin_reply ? t.editReply : t.reply}
                </button>
                <button
                  onClick={() => { setDeleteModal(detailModal); setDetailModal(null); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> {t.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply modal */}
      {replyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setReplyModal(null); setReplyText(''); }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{t.replyToReview}</h2>
              <button onClick={() => { setReplyModal(null); setReplyText(''); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">{replyModal.first_name} {replyModal.last_name}</p>
                  <StarRating rating={replyModal.rating} />
                </div>
                <p className="text-sm text-gray-600">{replyModal.comment}</p>
              </div>
              <div>
                <label htmlFor="reply-text" className="block text-sm font-medium text-gray-700 mb-1">{t.yourReply}</label>
                <textarea
                  id="reply-text"
                  rows={4}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={t.writeReply}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30] resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setReplyModal(null); setReplyText(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                  className="px-4 py-2 bg-[#FF4D30] text-white text-sm font-medium rounded-lg hover:bg-[#E6442B] transition-colors disabled:opacity-50"
                >
                  {replying ? t.sending : t.sendReply}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">{t.deleteReview}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {t.deleteReviewConfirm}
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
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
