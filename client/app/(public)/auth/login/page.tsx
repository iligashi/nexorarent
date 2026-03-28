'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useLanguageStore } from '@/stores/languageStore';

export default function LoginPage() {
  const { t } = useLanguageStore();
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="pt-24 pb-16 px-6 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-outfit font-bold text-3xl text-white mb-2">{t.welcomeBack}</h1>
          <p className="text-text-secondary">{t.signInSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-6 space-y-5">
          {error && <p className="text-error text-sm bg-error/10 px-4 py-2 rounded">{error}</p>}
          <Input label={t.email} type="email" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
          <Input label={t.password} type="password" icon={Lock} value={password} onChange={e => setPassword(e.target.value)} placeholder={t.yourPassword} />
          <Button type="submit" size="lg" className="w-full" loading={loading}>{t.signIn}</Button>
          <p className="text-text-muted text-sm text-center">
            {t.noAccount}{' '}
            <Link href="/auth/register" className="text-accent hover:underline">{t.register}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
