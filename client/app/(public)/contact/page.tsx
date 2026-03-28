'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, MessageCircle, Send } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { useLanguageStore } from '@/stores/languageStore';

export default function ContactPage() {
  const { t } = useLanguageStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const isValidPhone = (phone: string): boolean => {
    if (!phone) return true; // optional
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+?\d{8,15}$/.test(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phone && !isValidPhone(form.phone)) {
      setPhoneError(t.validPhoneError);
      return;
    }
    setLoading(true);
    try {
      await api.post('/contact', form);
      toast.success(t.messageSent);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      toast.error(t.messageFailed);
    }
    setLoading(false);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">{t.contactUs}</p>
          <h1 className="font-outfit font-bold text-4xl text-white mb-4">{t.getInTouch}</h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            {t.contactSubtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6">
            {[
              { icon: MapPin, title: t.ourOffice, detail: 'Rruga Adem Jashari, Drenas, Kosovo' },
              { icon: Phone, title: t.phone, detail: '+383 44 123 456' },
              { icon: Mail, title: t.email, detail: 'info@nexorarentacar.com' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4 p-5 bg-bg-secondary border border-border rounded-xl">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-text-secondary text-sm">{item.detail}</p>
                </div>
              </div>
            ))}

            {/* Quick action buttons */}
            <div className="flex gap-4">
              <a
                href="https://wa.me/38344123456?text=Hi, I'd like to rent a car"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="lg" className="w-full">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
              </a>
              <a href="tel:+38344123456" className="flex-1">
                <Button variant="secondary" size="lg" className="w-full">
                  <Phone className="w-4 h-4 mr-2" /> {t.callUs}
                </Button>
              </a>
            </div>

            {/* Map */}
            <div className="aspect-video bg-bg-secondary border border-border rounded-xl overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d23478.84825498741!2d20.879!3d42.627!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x13538c4bbd9b0b4d%3A0x3e1b6e68e4481e6a!2sDrenas%2C%20Kosovo!5e0!3m2!1sen!2s!4v1700000000000"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Drenas, Kosovo - Nexora Rent a Car"
              />
            </div>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-6 space-y-5">
            <h3 className="font-outfit font-semibold text-white text-xl mb-2">{t.sendUsMessage}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t.name} value={form.name} onChange={set('name')} placeholder={t.yourName} />
              <Input
                label={t.phone}
                type="tel"
                value={form.phone}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^[+\d\s\-()]*$/.test(val)) {
                    setForm(prev => ({ ...prev, phone: val }));
                    setPhoneError('');
                  }
                }}
                onBlur={() => {
                  if (form.phone && !isValidPhone(form.phone)) {
                    setPhoneError(t.validPhoneError);
                  } else {
                    setPhoneError('');
                  }
                }}
                error={phoneError}
                placeholder="+383 44 123 456"
              />
            </div>
            <Input label={t.email} type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" />
            <Input label={t.subject} value={form.subject} onChange={set('subject')} placeholder={t.rentalInquiry} />
            <div>
              <label className="text-text-secondary text-sm font-medium mb-2 block">{t.message}</label>
              <textarea
                value={form.message}
                onChange={set('message')}
                rows={5}
                placeholder={t.howCanWeHelp}
                className="w-full bg-surface border border-border rounded px-4 py-2.5 text-white text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              <Send className="w-4 h-4 mr-2" /> {t.sendMessage}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
