'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, first_name: form.first_name, last_name: form.last_name, phone: form.phone || undefined });
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
    setLoading(false);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="pt-24 pb-16 px-6 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-outfit font-bold text-3xl text-white mb-2">Create Account</h1>
          <p className="text-text-secondary">Join us for a better booking experience</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4">
          {error && <p className="text-error text-sm bg-error/10 px-4 py-2 rounded">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" icon={User} value={form.first_name} onChange={set('first_name')} placeholder="John" />
            <Input label="Last Name" icon={User} value={form.last_name} onChange={set('last_name')} placeholder="Doe" />
          </div>
          <Input label="Email" type="email" icon={Mail} value={form.email} onChange={set('email')} placeholder="your@email.com" />
          <Input label="Phone" icon={Phone} value={form.phone} onChange={set('phone')} placeholder="+383 44 ..." />
          <Input label="Password" type="password" icon={Lock} value={form.password} onChange={set('password')} placeholder="Min 6 characters" />
          <Input label="Confirm Password" type="password" icon={Lock} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" />
          <Button type="submit" size="lg" className="w-full" loading={loading}>Create Account</Button>
          <p className="text-text-muted text-sm text-center">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-accent hover:underline">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
