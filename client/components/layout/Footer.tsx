'use client';

import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Camera, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* About */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-accent flex items-center justify-center">
                <span className="font-outfit font-bold text-white text-sm">DR</span>
              </div>
              <div>
                <p className="font-outfit font-bold text-white text-lg leading-none">DRENAS</p>
                <p className="text-text-muted text-[10px] tracking-[3px] uppercase">Rent a Car</p>
              </div>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              Premium car rental service in Drenas, Kosovo. Luxury, SUV, and economy vehicles
              for every occasion. Trusted since 2020.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-full bg-bg-tertiary hover:bg-accent transition-colors text-text-secondary hover:text-white">
                <Globe className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-full bg-bg-tertiary hover:bg-accent transition-colors text-text-secondary hover:text-white">
                <Camera className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-full bg-bg-tertiary hover:bg-accent transition-colors text-text-secondary hover:text-white">
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-outfit font-semibold text-white mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { href: '/cars', label: 'Our Fleet' },
                { href: '/reserve', label: 'Book Now' },
                { href: '/about', label: 'About Us' },
                { href: '/blog', label: 'Blog' },
                { href: '/contact', label: 'Contact' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-text-secondary hover:text-accent transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Car Categories */}
          <div>
            <h4 className="font-outfit font-semibold text-white mb-6">Vehicle Types</h4>
            <ul className="space-y-3">
              {['Economy', 'Compact', 'Sedan', 'SUV', 'Luxury', 'Sports'].map((cat) => (
                <li key={cat}>
                  <Link
                    href={`/cars?category=${cat.toLowerCase()}`}
                    className="text-text-secondary hover:text-accent transition-colors text-sm"
                  >
                    {cat} Cars
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-outfit font-semibold text-white mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-accent mt-1 shrink-0" />
                <span className="text-text-secondary text-sm">Rruga Adem Jashari, Drenas, Kosovo</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-accent shrink-0" />
                <a href="tel:+38344123456" className="text-text-secondary hover:text-accent text-sm">+383 44 123 456</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <a href="mailto:info@drenasrentacar.com" className="text-text-secondary hover:text-accent text-sm">info@drenasrentacar.com</a>
              </li>
            </ul>
            <div className="mt-6 p-4 bg-bg-tertiary rounded-lg">
              <p className="text-text-muted text-xs mb-1">Working Hours</p>
              <p className="text-text-secondary text-sm">Mon-Fri: 08:00 - 20:00</p>
              <p className="text-text-secondary text-sm">Saturday: 09:00 - 18:00</p>
              <p className="text-text-secondary text-sm">Sunday: 10:00 - 16:00</p>
            </div>
          </div>
        </div>

        <hr className="border-border my-10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            &copy; {new Date().getFullYear()} Drenas Rent a Car. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-text-muted hover:text-text-secondary text-sm">Privacy Policy</Link>
            <Link href="#" className="text-text-muted hover:text-text-secondary text-sm">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
