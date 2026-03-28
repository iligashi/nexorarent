'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import {
  MapPin, Calendar, Search, ArrowRight, Shield, Headphones, Car, Star, ChevronDown, ChevronLeft, ChevronRight,
  Gauge, Truck, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import CarCard from '@/components/cars/CarCard';
import Button from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { useLanguageStore } from '@/stores/languageStore';
import { formatPrice } from '@/lib/utils';
import type { Car as CarType, Location } from '@/types';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 20);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Social sidebar icons
function SocialSidebar() {
  return (
    <div className="hidden lg:flex fixed left-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-4">
      {[
        { icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z', href: '#', label: 'Facebook' },
        { icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z', href: '#', label: 'Instagram' },
        { icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z', href: 'https://wa.me/38344123456', label: 'WhatsApp' },
      ].map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-accent transition-colors text-white/60 hover:text-white"
          title={s.label}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d={s.icon} />
          </svg>
        </a>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { t } = useLanguageStore();
  const [featuredCars, setFeaturedCars] = useState<CarType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [pickupLoc, setPickupLoc] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [dropoffDate, setDropoffDate] = useState('');
  const [heroSlide, setHeroSlide] = useState(0);

  const heroImages = [
    'https://images.unsplash.com/photo-1563720223185-11003d516935?w=1920&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&q=80',
    'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1920&q=80',
  ];

  useEffect(() => {
    api.get('/cars/featured').then(r => setFeaturedCars(r.data.cars)).catch(() => {});
    api.get('/locations').then(r => setLocations(r.data.locations)).catch(() => {});
  }, []);

  // Auto-rotate hero
  useEffect(() => {
    const timer = setInterval(() => setHeroSlide(s => (s + 1) % heroImages.length), 5000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (pickupLoc) params.set('pickup', pickupLoc);
    if (pickupDate) params.set('pickup_date', pickupDate);
    if (dropoffDate) params.set('dropoff_date', dropoffDate);
    window.location.href = `/cars?${params.toString()}`;
  };

  const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  const featuredCar = featuredCars[0];

  return (
    <>
      <SocialSidebar />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center overflow-hidden grain">
        {/* Slideshow backgrounds */}
        {heroImages.map((img, i) => (
          <div
            key={img}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
            style={{
              backgroundImage: `url('${img}')`,
              opacity: heroSlide === i ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary via-bg-primary/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/40 via-transparent to-bg-primary" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-accent text-sm font-semibold tracking-[4px] uppercase mb-4">
                {t.premiumCarRental}
              </p>
              <h1 className="font-outfit font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-gradient leading-[1.05] mb-6">
                {t.heroTitle1}<br />
                {t.heroTitle2}<br />
                {t.heroTitle3}
              </h1>

              {/* Featured car info */}
              {featuredCar && (
                <div className="mb-8">
                  <p className="text-text-secondary text-sm uppercase tracking-wider">
                    {featuredCar.brand} {featuredCar.model} {featuredCar.year}
                  </p>
                  <p className="text-accent text-2xl font-outfit font-bold mt-1">
                    {formatPrice(Number(featuredCar.price_per_day))} <span className="text-text-muted text-sm font-normal">{t.perDay}</span>
                  </p>
                </div>
              )}

              <Link href="/reserve">
                <Button size="lg">
                  {t.driveNow} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Slide indicators */}
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button onClick={() => setHeroSlide(s => (s - 1 + heroImages.length) % heroImages.length)} className="text-white/50 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroSlide(i)}
                  className={`h-0.5 rounded-full transition-all ${heroSlide === i ? 'w-10 bg-accent' : 'w-6 bg-white/30'}`}
                />
              ))}
            </div>
            <button onClick={() => setHeroSlide(s => (s + 1) % heroImages.length)} className="text-white/50 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-6 h-6 text-text-muted" />
        </motion.div>
      </section>

      {/* Featured Cars / Today's Specials */}
      <section className="py-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-12"
          >
            <div>
              <p className="text-accent text-sm font-semibold tracking-[3px] uppercase mb-2">{t.ourFleet}</p>
              <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white">
                {t.todaysSpecials}
              </h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-3">
                {['SUV', 'Luxury', 'Sportcar'].map(cat => (
                  <Link
                    key={cat}
                    href={`/cars?category=${cat.toLowerCase()}`}
                    className="text-text-muted hover:text-accent transition-colors text-sm uppercase tracking-wide"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
              <Link
                href="/cars"
                className="text-accent flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all border border-accent px-4 py-2 rounded"
              >
                {t.viewAllCars}
              </Link>
            </div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {featuredCars.slice(0, 6).map((car) => (
              <motion.div key={car.id} variants={itemVariants}>
                <CarCard car={car} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Nexora Brand Banner + Follow Us */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch">
            {/* Image side */}
            <div className="relative h-[400px] lg:h-auto min-h-[400px] overflow-hidden rounded-l-2xl">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=1200&q=80')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg-primary/60" />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-bg-primary/80 backdrop-blur-sm border border-[#D4A853]/30 p-6 flex flex-col items-center">
                <LogoMark size={64} />
                <p className="font-outfit font-bold text-lg leading-tight mt-3 tracking-[2px]" style={{ background: 'linear-gradient(135deg, #F5ECD4 0%, #D4A853 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>NEXORA</p>
                <Link href="#" className="text-[#D4A853] text-xs tracking-[2px] uppercase mt-3 flex items-center gap-2 hover:gap-3 transition-all">
                  {t.followUs} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Content side */}
            <div className="bg-bg-secondary p-10 lg:p-14 flex flex-col justify-center rounded-r-2xl">
              <h2 className="font-outfit font-bold text-2xl md:text-3xl text-white mb-6">
                {t.luxuryCarRental}
              </h2>
              <p className="text-text-secondary leading-relaxed mb-8">
                {t.luxuryDesc}
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { icon: Gauge, title: t.mileageUnlimited },
                  { icon: Truck, title: t.pickUpService },
                  { icon: ShieldCheck, title: t.fullInsurance },
                ].map((f) => (
                  <div key={f.title} className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                      <f.icon className="w-6 h-6 text-accent" />
                    </div>
                    <p className="text-white text-xs font-semibold uppercase tracking-wide">{f.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 px-6 bg-bg-secondary relative grain">
        <div className="relative z-10 max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-accent text-sm font-semibold tracking-[3px] uppercase mb-2">{t.whyUs}</p>
            <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white">
              {t.whyChoose}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Car, value: 30, suffix: '+', label: t.vehiclesAvailable },
              { icon: Star, value: 500, suffix: '+', label: t.happyCustomers },
              { icon: Shield, value: 5, suffix: '+', label: t.yearsExperience },
              { icon: Headphones, value: 24, suffix: '/7', label: t.customerSupport },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 rounded-xl border border-border bg-bg-primary/50 hover:border-accent/30 transition-colors"
              >
                <item.icon className="w-10 h-10 text-accent mx-auto mb-4" />
                <p className="font-outfit font-bold text-4xl text-white mb-2">
                  <AnimatedCounter target={item.value} suffix={item.suffix} />
                </p>
                <p className="text-text-secondary text-sm">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-bg-primary/85" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-outfit font-bold text-3xl md:text-5xl text-white mb-6">
              {t.readyAdventure}
            </h2>
            <p className="text-text-secondary text-lg mb-8">
              {t.ctaSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/reserve">
                <Button size="lg">
                  {t.reserveNow} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/cars">
                <Button variant="outline" size="lg">{t.browseFleet}</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Row */}
      <section className="py-16 px-6 bg-bg-secondary border-t border-border">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Gauge, title: t.mileageUnlimited, desc: t.mileageDesc },
              { icon: Car, title: t.pickUpService, desc: t.pickUpDesc },
              { icon: Shield, title: t.fullInsurance, desc: t.insuranceDesc },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h4 className="font-outfit font-semibold text-white mb-1">{f.title}</h4>
                  <p className="text-text-secondary text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
