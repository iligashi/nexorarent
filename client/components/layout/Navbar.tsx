'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Phone, ChevronDown, Globe, Star } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';
import { LogoFull } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { lang, setLang, t } = useLanguageStore();
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);

  const navLinks = [
    { href: '/', label: t.home },
    { href: '/cars', label: t.garage },
    { href: '/about', label: t.aboutUs },
    { href: '/blog', label: t.blog },
    { href: '/contact', label: t.contact },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user) { setLoyaltyPoints(null); return; }
    api.get('/auth/me/loyalty').then(({ data }) => setLoyaltyPoints(data.points_balance)).catch(() => {});
  }, [user]);

  const toggleLang = () => setLang(lang === 'en' ? 'sq' : 'en');

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-bg-primary/90 backdrop-blur-xl border-b border-border shadow-lg'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <LogoFull size={42} />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-text-secondary hover:text-white transition-colors text-sm font-medium tracking-wide uppercase"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Language switcher */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 text-text-secondary hover:text-white transition-colors text-sm px-2 py-1 rounded border border-border hover:border-accent/50"
            title={lang === 'en' ? 'Shqip' : 'English'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-medium uppercase text-xs">{lang === 'en' ? 'SQ' : 'EN'}</span>
          </button>

          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm">
                {user.first_name}
                {loyaltyPoints !== null && (
                  <span className="flex items-center gap-1 text-accent text-xs font-semibold">
                    <Star className="w-3 h-3 fill-accent" />{loyaltyPoints}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-bg-secondary border border-border rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {loyaltyPoints !== null && (
                  <div className="px-4 py-2 border-b border-border mb-1">
                    <div className="flex items-center gap-1.5 text-accent text-sm font-semibold">
                      <Star className="w-3.5 h-3.5 fill-accent" />
                      {loyaltyPoints} {lang === 'sq' ? 'pikë' : 'pts'}
                    </div>
                  </div>
                )}
                {['staff', 'manager', 'owner'].includes(user.role) && (
                  <Link href="/admin" className="block px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-tertiary">
                    {t.dashboard}
                  </Link>
                )}
                <Link href="/my-bookings" className="block px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-tertiary">
                  {t.myBookings}
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-tertiary"
                >
                  {t.logout}
                </button>
              </div>
            </div>
          ) : (
            <Link href="/auth/login" className="text-text-secondary hover:text-white text-sm">
              {t.login}
            </Link>
          )}
          <Link
            href="/reserve"
            className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 text-sm font-semibold tracking-wide transition-all glow-accent rounded"
          >
            {t.reserveNow}
          </Link>
          <a href="tel:+38344123456" className="flex items-center gap-2 text-text-secondary hover:text-accent transition-colors">
            <Phone className="w-4 h-4" />
            <span className="text-sm">+383 44 123 456</span>
          </a>
        </div>

        {/* Mobile toggle */}
        <div className="flex lg:hidden items-center gap-3">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 text-text-secondary hover:text-white text-xs px-2 py-1 rounded border border-border"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-medium uppercase">{lang === 'en' ? 'SQ' : 'EN'}</span>
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-white p-2"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-bg-primary border-t border-border overflow-hidden"
          >
            <div className="px-6 py-6 flex flex-col gap-4">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-text-secondary hover:text-white text-lg font-medium block py-2"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <hr className="border-border" />
              {user ? (
                <>
                  {loyaltyPoints !== null && (
                    <div className="flex items-center gap-1.5 text-accent text-sm font-semibold py-2">
                      <Star className="w-4 h-4 fill-accent" />
                      {loyaltyPoints} {lang === 'sq' ? 'pikë' : 'pts'}
                    </div>
                  )}
                  <Link href="/my-bookings" onClick={() => setMobileOpen(false)} className="text-text-secondary py-2">{t.myBookings}</Link>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="text-text-secondary text-left py-2">{t.logout}</button>
                </>
              ) : (
                <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="text-text-secondary py-2">{t.login}</Link>
              )}
              <Link
                href="/reserve"
                onClick={() => setMobileOpen(false)}
                className="bg-accent text-white text-center py-3 font-semibold rounded mt-2"
              >
                {t.reserveNow}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
