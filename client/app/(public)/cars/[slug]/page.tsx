'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Fuel, Cog, Users, DoorOpen, Gauge, Star, Calendar, MessageCircle, ArrowLeft, Check,
} from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import CarCard from '@/components/cars/CarCard';
import { formatPrice, formatDate } from '@/lib/utils';
import type { Car } from '@/types';

export default function CarDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [car, setCar] = useState<Car | null>(null);
  const [similarCars, setSimilarCars] = useState<Car[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.get(`/cars/${slug}`)
      .then(r => {
        setCar(r.data.car);
        // Fetch similar cars
        return api.get('/cars', { params: { category: r.data.car.category, limit: 4 } });
      })
      .then(r => setSimilarCars(r.data.cars.filter((c: Car) => c.slug !== slug).slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="pt-24 pb-16 px-6 max-w-[1400px] mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-bg-tertiary rounded w-48" />
          <div className="aspect-[16/9] bg-bg-tertiary rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-40 bg-bg-tertiary rounded col-span-2" />
            <div className="h-40 bg-bg-tertiary rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="pt-24 pb-16 px-6 text-center">
        <p className="text-text-muted text-lg">Car not found</p>
        <Link href="/cars" className="text-accent mt-4 inline-block">Back to Fleet</Link>
      </div>
    );
  }

  const images = car.images || [];
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || '';
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${apiBase}${url}`;
  };
  const currentImg = images[selectedImage]?.url
    ? getImageUrl(images[selectedImage].url)
    : 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80';

  const specs = [
    { icon: Fuel, label: 'Fuel', value: car.fuel },
    { icon: Cog, label: 'Transmission', value: car.transmission },
    { icon: Users, label: 'Seats', value: car.seats },
    { icon: DoorOpen, label: 'Doors', value: car.doors },
    { icon: Gauge, label: 'Horsepower', value: `${car.horsepower} HP` },
  ];

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Back link */}
        <Link href="/cars" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Fleet
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Images + Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Main Image */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative aspect-[16/9] rounded-xl overflow-hidden bg-bg-secondary"
            >
              <img
                src={currentImg}
                alt={`${car.brand} ${car.model}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </motion.div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`relative w-20 h-16 rounded overflow-hidden shrink-0 border-2 transition-colors ${
                      i === selectedImage ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getImageUrl(img.url)}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Car Info */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="font-outfit font-bold text-3xl text-white">
                    {car.brand} {car.model}
                  </h1>
                  <p className="text-text-muted">{car.year} &middot; {car.category} &middot; {car.color}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-gold fill-gold" />
                  <span className="text-white font-semibold">{Number(car.avg_rating).toFixed(1)}</span>
                  <span className="text-text-muted text-sm">({car.review_count} reviews)</span>
                </div>
              </div>

              {car.description && (
                <p className="text-text-secondary leading-relaxed mt-4">{car.description}</p>
              )}
            </div>

            {/* Specs Table */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {specs.map(s => (
                <div key={s.label} className="bg-bg-secondary border border-border rounded-lg p-4 flex items-center gap-3">
                  <s.icon className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-text-muted text-xs">{s.label}</p>
                    <p className="text-white text-sm font-medium capitalize">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Features */}
            {car.features && car.features.length > 0 && (
              <div>
                <h3 className="font-outfit font-semibold text-white text-lg mb-4">Features</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {car.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-text-secondary text-sm">
                      <Check className="w-4 h-4 text-success" /> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {car.reviews && car.reviews.length > 0 && (
              <div>
                <h3 className="font-outfit font-semibold text-white text-lg mb-4">
                  Customer Reviews ({car.review_count})
                </h3>
                <div className="space-y-4">
                  {car.reviews.map(r => (
                    <div key={r.id} className="bg-bg-secondary border border-border rounded-lg p-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white font-medium">{r.first_name} {r.last_name}</p>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'text-gold fill-gold' : 'text-text-muted'}`} />
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-text-secondary text-sm">{r.comment}</p>}
                      <p className="text-text-muted text-xs mt-2">{formatDate(r.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Booking */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 bg-bg-secondary border border-border rounded-xl p-6 space-y-6">
              <div>
                <span className="text-text-muted text-sm">Price per day</span>
                <p className="font-outfit font-bold text-3xl text-accent">
                  {formatPrice(Number(car.price_per_day))}
                  <span className="text-text-muted text-sm font-normal">/day</span>
                </p>
                {car.price_per_week && (
                  <p className="text-text-muted text-sm">
                    Weekly: {formatPrice(Number(car.price_per_week))}
                  </p>
                )}
              </div>

              {car.deposit > 0 && (
                <p className="text-text-muted text-sm">
                  Deposit: {formatPrice(Number(car.deposit))}
                </p>
              )}

              <Link href={`/reserve?car=${car.id}`}>
                <Button size="lg" className="w-full mt-4">
                  <Calendar className="w-4 h-4 mr-2" /> Reserve This Car
                </Button>
              </Link>

              <a
                href={`https://wa.me/38344123456?text=Hi, I'm interested in renting the ${car.brand} ${car.model}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" className="w-full">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Similar Cars */}
        {similarCars.length > 0 && (
          <div className="mt-20">
            <h3 className="font-outfit font-semibold text-white text-2xl mb-6">Similar Cars</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarCars.map(c => <CarCard key={c.id} car={c} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
