'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Phone, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/cars', label: 'Garage' },
  { href: '/about', label: 'About Us' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent flex items-center justify-center">
            <span className="font-outfit font-bold text-white text-sm leading-tight">
              DR
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="font-outfit font-bold text-white text-lg leading-none">DRENAS</p>
            <p className="text-text-muted text-[10px] tracking-[3px] uppercase">Rent a Car</p>
          </div>
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
          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm">
                {user.first_name} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-bg-secondary border border-border rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {['staff', 'manager', 'owner'].includes(user.role) && (
                  <Link href="/admin" className="block px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-tertiary">
                    Dashboard
                  </Link>
                )}
                <Link href="/my-bookings" className="block px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-tertiary">
                  My Bookings
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-tertiary"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link href="/auth/login" className="text-text-secondary hover:text-white text-sm">
              Login
            </Link>
          )}
          <Link
            href="/reserve"
            className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 text-sm font-semibold tracking-wide transition-all glow-accent rounded"
          >
            Reserve Now
          </Link>
          <a href="tel:+38344123456" className="flex items-center gap-2 text-text-secondary hover:text-accent transition-colors">
            <Phone className="w-4 h-4" />
            <span className="text-sm">+383 44 123 456</span>
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden text-white p-2"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
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
                  <Link href="/my-bookings" onClick={() => setMobileOpen(false)} className="text-text-secondary py-2">My Bookings</Link>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="text-text-secondary text-left py-2">Logout</button>
                </>
              ) : (
                <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="text-text-secondary py-2">Login</Link>
              )}
              <Link
                href="/reserve"
                onClick={() => setMobileOpen(false)}
                className="bg-accent text-white text-center py-3 font-semibold rounded mt-2"
              >
                Reserve Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
