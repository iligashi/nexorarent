'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { Mail, MailOpen, X } from 'lucide-react';
import type { ContactMessage } from '@/types';
import { useLanguageStore } from '@/stores/languageStore';

export default function AdminMessagesPage() {
  const { t } = useLanguageStore();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/admin/messages');
        setMessages(data.messages);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.put(`/admin/messages/${id}/read`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const openMessage = (msg: ContactMessage) => {
    setSelected(msg);
    if (!msg.is_read) markRead(msg.id);
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.messages}</h1>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-16" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-outfit">{t.messages}</h1>
        {unreadCount > 0 && (
          <span className="px-2.5 py-0.5 bg-[#FF4D30] text-white text-xs font-semibold rounded-full">{unreadCount} new</span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t.noMessagesYet}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => openMessage(msg)}
              className={cn(
                'w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4',
                !msg.is_read && 'bg-blue-50/50'
              )}
            >
              <div className="mt-0.5">
                {msg.is_read ? <MailOpen className="w-5 h-5 text-gray-400" /> : <Mail className="w-5 h-5 text-[#FF4D30]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-sm truncate', !msg.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>{msg.name}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-gray-600 truncate">{msg.subject || t.noSubject}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{msg.message}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Message detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{selected.subject || 'No subject'}</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">{t.from}</p><p className="font-medium">{selected.name}</p></div>
                <div><p className="text-gray-500">{t.email}</p><p className="font-medium">{selected.email}</p></div>
                {selected.phone && <div><p className="text-gray-500">{t.phone}</p><p className="font-medium">{selected.phone}</p></div>}
                <div><p className="text-gray-500">{t.date}</p><p className="font-medium">{formatDateTime(selected.created_at)}</p></div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">{t.message}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>
              <div className="border-t border-gray-100 pt-4 flex gap-3">
                <a href={`mailto:${selected.email}`} className="px-4 py-2.5 bg-[#FF4D30] text-white text-sm font-semibold rounded-lg hover:bg-[#E6442B]">{t.replyViaEmail}</a>
                {selected.phone && (
                  <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600">WhatsApp</a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
