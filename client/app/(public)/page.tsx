'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import {
  MapPin, Calendar, Clock, Search, ArrowRight, Shield, Headphones, Car, Star, ChevronDown,
} from 'lucide-react';
import api from '@/lib/api';
import CarCard from '@/components/cars/CarCard';
import Button from '@/components/ui/Button';
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

export default function HomePage() {
  const [featuredCars, setFeaturedCars] = useState<CarType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [pickupLoc, setPickupLoc] = useState('');
  const [dropoffLoc, setDropoffLoc] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [dropoffDate, setDropoffDate] = useState('');

  useEffect(() => {
    api.get('/cars/featured').then(r => setFeaturedCars(r.data.cars)).catch(() => {});
    api.get('/locations').then(r => setLocations(r.data.locations)).catch(() => {});
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (pickupLoc) params.set('pickup', pickupLoc);
    if (dropoffLoc) params.set('dropoff', dropoffLoc);
    if (pickupDate) params.set('pickup_date', pickupDate);
    if (dropoffDate) params.set('dropoff_date', dropoffDate);
    window.location.href = `/cars?${params.toString()}`;
  };

  const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  return (
    <>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden grain">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-bg-primary/40 to-bg-primary" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-accent text-sm font-semibold tracking-[4px] uppercase mb-4">
              Premium Car Rental
            </p>
            <h1 className="font-outfit font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-gradient leading-[1.05] mb-6">
              LUXURY<br />
              LIFESTYLE<br />
              RENTALS
            </h1>
            <p className="text-text-secondary text-lg max-w-xl mx-auto mb-10">
              Experience premium car rental in Drenas, Kosovo. From economy to luxury,
              find the perfect vehicle for your journey.
            </p>
          </motion.div>

          {/* Reservation Widget */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="glass rounded-2xl p-6 md:p-8 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Pickup Location
                </label>
                <select
                  value={pickupLoc}
                  onChange={(e) => setPickupLoc(e.target.value)}
                  className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                >
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Pickup Date
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Return Date
                </label>
                <input
                  type="date"
                  value={dropoffDate}
                  onChange={(e) => setDropoffDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} size="lg" className="w-full">
                  <Search className="w-4 h-4 mr-2" /> Search Cars
                </Button>
              </div>
            </div>
          </motion.div>
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

      {/* Featured Cars */}
      <section className="py-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-12"
          >
            <div>
              <p className="text-accent text-sm font-semibold tracking-[3px] uppercase mb-2">Our Fleet</p>
              <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white">
                TODAY&apos;S SPECIALS
              </h2>
            </div>
            <Link
              href="/cars"
              className="text-accent flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all"
            >
              View All Cars <ArrowRight className="w-4 h-4" />
            </Link>
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

      {/* Why Choose Us */}
      <section className="py-24 px-6 bg-bg-secondary relative grain">
        <div className="relative z-10 max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-accent text-sm font-semibold tracking-[3px] uppercase mb-2">Why Us</p>
            <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white">
              WHY CHOOSE DRENAS RENT A CAR
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Car, value: 30, suffix: '+', label: 'Vehicles Available' },
              { icon: Star, value: 500, suffix: '+', label: 'Happy Customers' },
              { icon: Shield, value: 5, suffix: '+', label: 'Years Experience' },
              { icon: Headphones, value: 24, suffix: '/7', label: 'Customer Support' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
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
              Ready for Your Next Adventure?
            </h2>
            <p className="text-text-secondary text-lg mb-8">
              Book your perfect car today and explore Kosovo in style.
              Best prices guaranteed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/reserve">
                <Button size="lg">
                  Reserve Now <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/cars">
                <Button variant="outline" size="lg">Browse Fleet</Button>
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
              { icon: MapPin, title: 'Mileage Unlimited', desc: 'Drive without limits — no extra charges per kilometer.' },
              { icon: Car, title: 'Pick Up Service', desc: 'We deliver the car to your location in Drenas and Pristina.' },
              { icon: Shield, title: 'Full Insurance', desc: 'Drive with peace of mind — comprehensive coverage included.' },
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
