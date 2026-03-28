'use client';

import { motion } from 'framer-motion';
import { Car, Users, MapPin, Award } from 'lucide-react';
import { useLanguageStore } from '@/stores/languageStore';

export default function AboutPage() {
  const { t } = useLanguageStore();

  const stats = [
    { icon: Car, value: '30+', label: t.vehicles },
    { icon: Users, value: '500+', label: t.happyCustomers },
    { icon: MapPin, value: '5', label: t.locations },
    { icon: Award, value: '5+', label: t.yearsExperience },
  ];

  return (
    <div className="pt-24 pb-16">
      {/* Hero */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-bg-primary/85" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">{t.aboutUs}</p>
            <h1 className="font-outfit font-bold text-4xl md:text-5xl text-white mb-6">
              {t.aboutHeroTitle}
            </h1>
            <p className="text-text-secondary text-lg leading-relaxed">
              {t.aboutHeroDesc}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">{t.ourStory}</p>
            <h2 className="font-outfit font-bold text-3xl text-white mb-6">
              {t.fromDrenasToKosovo}
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              {t.aboutStoryP1}
            </p>
            <p className="text-text-secondary leading-relaxed">
              {t.aboutStoryP2}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {stats.map(item => (
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
          <p className="text-accent text-sm tracking-[3px] uppercase font-semibold mb-3">{t.ourValues}</p>
          <h2 className="font-outfit font-bold text-3xl text-white mb-12">{t.whatWeStandFor}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: t.reliability, desc: t.reliabilityDesc },
              { title: t.transparency, desc: t.transparencyDesc },
              { title: t.serviceValue, desc: t.serviceDesc },
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
