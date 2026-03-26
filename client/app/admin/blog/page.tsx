'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import DataTable from '@/components/admin/DataTable';
import AdminBadge from '@/components/admin/AdminBadge';
import { Plus, X } from 'lucide-react';
import type { BlogPost } from '@/types';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [form, setForm] = useState({ title: '', content: '', excerpt: '', is_published: false });
  const [saving, setSaving] = useState(false);

  const fetchPosts = async () => {
    try {
      const { data } = await api.get('/admin/blog');
      setPosts(data.posts);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const openEditor = (post?: BlogPost) => {
    if (post) {
      setEditingPost(post);
      setForm({ title: post.title, content: post.content, excerpt: post.excerpt, is_published: post.is_published });
    } else {
      setEditingPost(null);
      setForm({ title: '', content: '', excerpt: '', is_published: false });
    }
    setShowEditor(true);
  };

  const savePost = async () => {
    setSaving(true);
    try {
      if (editingPost) {
        await api.put(`/admin/blog/${editingPost.id}`, form);
      } else {
        await api.post('/admin/blog', form);
      }
      setShowEditor(false);
      fetchPosts();
    } catch (err) {
      console.error('Failed to save post:', err);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'title', label: 'Title',
      render: (p: BlogPost) => <span className="font-medium text-gray-900">{p.title}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (p: BlogPost) => <AdminBadge status={p.is_published ? 'published' : 'draft'} />,
    },
    {
      key: 'created_at', label: 'Created',
      render: (p: BlogPost) => <span className="text-sm text-gray-500">{formatDate(p.created_at)}</span>,
    },
    {
      key: 'actions', label: '',
      render: (p: BlogPost) => (
        <button onClick={(e) => { e.stopPropagation(); openEditor(p); }} className="text-[#FF4D30] hover:underline text-sm font-medium">
          Edit
        </button>
      ),
    },
  ];

  const inputClass = 'w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D30]/20 focus:border-[#FF4D30]';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">Blog Posts</h1>
        <button onClick={() => openEditor()} className="inline-flex items-center gap-2 bg-[#FF4D30] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E6442B] transition-colors">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      <DataTable
        columns={columns as unknown as { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]}
        data={posts as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No blog posts yet"
      />

      {/* Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingPost ? 'Edit Post' : 'New Post'}</h2>
              <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Excerpt</label>
                <textarea rows={2} className={inputClass + ' resize-none'} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
                <textarea rows={12} className={inputClass + ' resize-none font-mono text-xs'} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="published" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4" />
                <label htmlFor="published" className="text-sm font-medium text-gray-700">Publish immediately</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowEditor(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={savePost} disabled={saving || !form.title || !form.content} className="px-6 py-2.5 bg-[#FF4D30] text-white text-sm font-semibold rounded-lg hover:bg-[#E6442B] disabled:opacity-50">
                {saving ? 'Saving...' : editingPost ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
