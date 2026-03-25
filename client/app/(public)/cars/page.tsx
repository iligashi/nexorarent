'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { SlidersHorizontal, Grid3X3, List, X } from 'lucide-react';
import api from '@/lib/api';
import CarCard from '@/components/cars/CarCard';
import Button from '@/components/ui/Button';
import type { Car } from '@/types';

const categories = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'sports'];
const fuels = ['petrol', 'diesel', 'hybrid', 'electric'];
const transmissions = ['manual', 'automatic'];
const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function CarsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    fuel: searchParams.get('fuel') || '',
    transmission: searchParams.get('transmission') || '',
    price_min: searchParams.get('price_min') || '',
    price_max: searchParams.get('price_max') || '',
    search: searchParams.get('search') || '',
    sort: searchParams.get('sort') || 'newest',
    page: Number(searchParams.get('page')) || 1,
  });

  const fetchCars = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '12', page: String(filters.page) };
      if (filters.category) params.category = filters.category;
      if (filters.fuel) params.fuel = filters.fuel;
      if (filters.transmission) params.transmission = filters.transmission;
      if (filters.price_min) params.price_min = filters.price_min;
      if (filters.price_max) params.price_max = filters.price_max;
      if (filters.search) params.search = filters.search;
      if (filters.sort) params.sort = filters.sort;

      const { data } = await api.get('/cars', { params });
      setCars(data.cars);
      setTotal(data.total);
    } catch {
      setCars([]);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ category: '', fuel: '', transmission: '', price_min: '', price_max: '', search: '', sort: 'newest', page: 1 });
  };

  const totalPages = Math.ceil(total / 12);

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-outfit font-semibold text-white">Filters</h3>
        <button onClick={clearFilters} className="text-accent text-xs hover:underline">Clear All</button>
      </div>

      {/* Search */}
      <div>
        <label className="text-text-muted text-xs font-medium mb-2 block">Search</label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          placeholder="Brand or model..."
          className="w-full bg-surface border border-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-text-muted text-xs font-medium mb-2 block">Category</label>
        <div className="space-y-2">
          {categories.map(cat => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={filters.category === cat}
                onChange={() => updateFilter('category', filters.category === cat ? '' : cat)}
                className="accent-accent"
              />
              <span className="text-text-secondary text-sm capitalize">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Fuel */}
      <div>
        <label className="text-text-muted text-xs font-medium mb-2 block">Fuel Type</label>
        <div className="space-y-2">
          {fuels.map(f => (
            <label key={f} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fuel"
                checked={filters.fuel === f}
                onChange={() => updateFilter('fuel', filters.fuel === f ? '' : f)}
                className="accent-accent"
              />
              <span className="text-text-secondary text-sm capitalize">{f}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Transmission */}
      <div>
        <label className="text-text-muted text-xs font-medium mb-2 block">Transmission</label>
        <div className="space-y-2">
          {transmissions.map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transmission"
                checked={filters.transmission === t}
                onChange={() => updateFilter('transmission', filters.transmission === t ? '' : t)}
                className="accent-accent"
              />
              <span className="text-text-secondary text-sm capitalize">{t}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="text-text-muted text-xs font-medium mb-2 block">Price Range (EUR/day)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.price_min}
            onChange={(e) => updateFilter('price_min', e.target.value)}
            placeholder="Min"
            className="w-1/2 bg-surface border border-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
          />
          <input
            type="number"
            value={filters.price_max}
            onChange={(e) => updateFilter('price_max', e.target.value)}
            placeholder="Max"
            className="w-1/2 bg-surface border border-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-accent text-sm font-semibold tracking-[3px] uppercase mb-2">Our Fleet</p>
          <h1 className="font-outfit font-bold text-3xl md:text-4xl text-white">
            Browse Our Cars
          </h1>
          <p className="text-text-secondary mt-2">{total} vehicles available</p>
        </div>

        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-28 bg-bg-secondary border border-border rounded-xl p-6">
              <FilterSidebar />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setShowFilters(true)}
                className="lg:hidden flex items-center gap-2 text-text-secondary text-sm border border-border px-3 py-2 rounded"
              >
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
              <div className="flex items-center gap-3">
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="bg-surface border border-border rounded px-3 py-2 text-white text-sm focus:outline-none"
                >
                  {sortOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Car Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-bg-secondary border border-border rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-bg-tertiary" />
                    <div className="p-5 space-y-3">
                      <div className="h-5 bg-bg-tertiary rounded w-3/4" />
                      <div className="h-4 bg-bg-tertiary rounded w-1/2" />
                      <div className="h-4 bg-bg-tertiary rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : cars.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-text-muted text-lg mb-4">No cars found matching your criteria.</p>
                <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {cars.map(car => (
                  <motion.div
                    key={car.id}
                    variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                  >
                    <CarCard car={car} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFilters(prev => ({ ...prev, page: i + 1 }))}
                    className={`w-10 h-10 rounded text-sm font-medium transition-colors ${
                      filters.page === i + 1
                        ? 'bg-accent text-white'
                        : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile filter overlay */}
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilters(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-bg-primary p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-outfit font-semibold text-white text-lg">Filters</h3>
                <button onClick={() => setShowFilters(false)}><X className="w-5 h-5 text-text-muted" /></button>
              </div>
              <FilterSidebar />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
