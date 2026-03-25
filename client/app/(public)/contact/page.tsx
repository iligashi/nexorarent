'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, MessageCircle, Send } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      toast.success('Message sent successfully!');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      toast.error('Failed to send message. Please try again.');
    }
    setLoading(false);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">Contact Us</p>
          <h1 className="font-outfit font-bold text-4xl text-white mb-4">Get In Touch</h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            Have a question or need a custom quote? Reach out to us through any of the channels below.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6">
            {[
              { icon: MapPin, title: 'Our Office', detail: 'Rruga Adem Jashari, Drenas, Kosovo' },
              { icon: Phone, title: 'Phone', detail: '+383 44 123 456' },
              { icon: Mail, title: 'Email', detail: 'info@drenasrentacar.com' },
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
                  <Phone className="w-4 h-4 mr-2" /> Call Us
                </Button>
              </a>
            </div>

            {/* Map placeholder */}
            <div className="aspect-video bg-bg-secondary border border-border rounded-xl flex items-center justify-center">
              <p className="text-text-muted text-sm">Map - Drenas, Kosovo</p>
            </div>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-6 space-y-5">
            <h3 className="font-outfit font-semibold text-white text-xl mb-2">Send us a message</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name" value={form.name} onChange={set('name')} placeholder="Your name" />
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+383 44 ..." />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" />
            <Input label="Subject" value={form.subject} onChange={set('subject')} placeholder="Rental inquiry" />
            <div>
              <label className="text-text-secondary text-sm font-medium mb-2 block">Message</label>
              <textarea
                value={form.message}
                onChange={set('message')}
                rows={5}
                placeholder="How can we help you?"
                className="w-full bg-surface border border-border rounded px-4 py-2.5 text-white text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              <Send className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
