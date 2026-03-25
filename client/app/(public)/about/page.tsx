'use client';

import { motion } from 'framer-motion';
import { Car, Users, MapPin, Award } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16">
      {/* Hero */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-bg-primary/85" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">About Us</p>
            <h1 className="font-outfit font-bold text-4xl md:text-5xl text-white mb-6">
              Your Trusted Car Rental Partner in Kosovo
            </h1>
            <p className="text-text-secondary text-lg leading-relaxed">
              Since 2020, Drenas Rent a Car has been providing premium car rental services
              to tourists, business travelers, and locals across Kosovo and the Balkans.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">Our Story</p>
            <h2 className="font-outfit font-bold text-3xl text-white mb-6">
              From Drenas to All of Kosovo
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              What started as a small family business with just 3 cars has grown into one of
              the most trusted car rental services in the region. We take pride in offering
              well-maintained vehicles at competitive prices with exceptional customer service.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Located in the heart of Drenas, we serve customers from Pristina Airport,
              Pristina City, Peja, and even cross-border trips to North Macedonia.
              Our diverse fleet ranges from fuel-efficient economy cars to premium luxury sedans and spacious SUVs.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              { icon: Car, value: '30+', label: 'Vehicles' },
              { icon: Users, value: '500+', label: 'Happy Customers' },
              { icon: MapPin, value: '5', label: 'Locations' },
              { icon: Award, value: '5+', label: 'Years Experience' },
            ].map(item => (
              <div key={item.label} className="bg-bg-secondary border border-border rounded-xl p-6 text-center">
                <item.icon className="w-8 h-8 text-accent mx-auto mb-3" />
                <p className="font-outfit font-bold text-2xl text-white">{item.value}</p>
                <p className="text-text-secondary text-sm">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6 bg-bg-secondary">
        <div className="max-w-[1400px] mx-auto text-center">
          <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">Our Values</p>
          <h2 className="font-outfit font-bold text-3xl text-white mb-12">What We Stand For</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Reliability', desc: 'Every car in our fleet is regularly maintained and inspected to ensure your safety and comfort.' },
              { title: 'Transparency', desc: 'No hidden fees, no surprises. What you see is what you pay. Deposit returned in full every time.' },
              { title: 'Service', desc: 'From airport pickup to 24/7 roadside assistance, we go the extra mile for every customer.' },
            ].map(v => (
              <div key={v.title} className="p-8 border border-border rounded-xl">
                <h3 className="font-outfit font-semibold text-white text-xl mb-3">{v.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
