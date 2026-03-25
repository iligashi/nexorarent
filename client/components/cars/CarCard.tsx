'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Fuel, Cog, Users, Star } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { Car } from '@/types';

export default function CarCard({ car }: { car: Car }) {
  const imgSrc = car.image
    ? (car.image.startsWith('http') ? car.image : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}${car.image}`)
    : '/placeholder-car.jpg';

  return (
    <motion.div
      whileHover={{ y: -8, rotateY: 2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group bg-bg-secondary border border-border rounded-xl overflow-hidden hover:shadow-xl hover:shadow-accent/5 transition-shadow"
    >
      <Link href={`/cars/${car.slug}`}>
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-bg-tertiary">
          <Image
            src={imgSrc}
            alt={`${car.brand} ${car.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Price badge */}
          <div className="absolute top-3 right-3 bg-accent px-3 py-1 rounded text-white text-sm font-bold">
            {formatPrice(Number(car.price_per_day))}/day
          </div>
          {/* Availability dot */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-bg-primary/80 backdrop-blur px-2 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${car.is_available ? 'bg-success' : 'bg-error'}`} />
            <span className="text-[10px] text-text-secondary">
              {car.is_available ? 'Available' : 'Booked'}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-5">
          <h3 className="font-outfit font-bold text-white text-lg">
            {car.brand} {car.model}
          </h3>
          <p className="text-text-muted text-sm mb-3">{car.year} &middot; {car.category}</p>

          {/* Specs row */}
          <div className="flex items-center gap-4 text-text-secondary text-xs mb-4">
            <span className="flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5" /> {car.fuel}
            </span>
            <span className="flex items-center gap-1">
              <Cog className="w-3.5 h-3.5" /> {car.transmission}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {car.seats}
            </span>
          </div>

          {/* Rating + CTA */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-gold fill-gold" />
              <span className="text-sm text-white font-medium">
                {Number(car.avg_rating).toFixed(1)}
              </span>
              <span className="text-text-muted text-xs">({car.review_count})</span>
            </div>
            <span className="text-accent text-sm font-semibold group-hover:underline">
              View Details &rarr;
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
