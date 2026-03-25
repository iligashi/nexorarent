'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Clock, Check, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useReservationStore } from '@/stores/reservationStore';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import CarCard from '@/components/cars/CarCard';
import { formatPrice } from '@/lib/utils';
import type { Location, Car, Extra } from '@/types';

const steps = ['Dates & Location', 'Choose Car', 'Extras', 'Your Details', 'Confirm'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            i + 1 < current ? 'bg-success text-white' :
            i + 1 === current ? 'bg-accent text-white' :
            'bg-bg-tertiary text-text-muted'
          }`}>
            {i + 1 < current ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-16 h-0.5 ${i + 1 < current ? 'bg-success' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ReservePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const store = useReservationStore();
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationNo, setConfirmationNo] = useState('');

  useEffect(() => {
    api.get('/locations').then(r => setLocations(r.data.locations)).catch(() => {});
    api.get('/extras').then(r => setExtras(r.data.extras)).catch(() => {});
    const carId = searchParams.get('car');
    if (carId) store.setCarId(carId);
  }, []);

  // Fetch available cars when dates are set and moving to step 2
  useEffect(() => {
    if (store.step === 2 && store.pickupDate && store.dropoffDate) {
      setLoading(true);
      api.get('/cars', { params: { limit: 50 } })
        .then(r => setCars(r.data.cars))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [store.step, store.pickupDate, store.dropoffDate]);

  const selectedCar = cars.find(c => c.id === store.selectedCarId);
  const totalDays = store.pickupDate && store.dropoffDate
    ? Math.max(1, Math.ceil((new Date(store.dropoffDate).getTime() - new Date(store.pickupDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const basePrice = selectedCar ? Number(selectedCar.price_per_day) * totalDays : 0;
  const extrasPrice = store.selectedExtras.reduce((sum, se) => {
    const ext = extras.find(e => e.id === se.extra_id);
    return sum + (ext ? Number(ext.price_per_day) * totalDays * se.quantity : 0);
  }, 0);
  const totalPrice = basePrice + extrasPrice;

  const canProceed = () => {
    switch (store.step) {
      case 1: return store.pickupLocation && store.dropoffLocation && store.pickupDate && store.dropoffDate;
      case 2: return !!store.selectedCarId;
      case 3: return true;
      case 4: return user || (store.guestName && store.guestEmail && store.guestPhone);
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        car_id: store.selectedCarId,
        pickup_location: store.pickupLocation,
        dropoff_location: store.dropoffLocation,
        pickup_date: `${store.pickupDate}T${store.pickupTime}:00`,
        dropoff_date: `${store.dropoffDate}T${store.dropoffTime}:00`,
        extras: store.selectedExtras,
        notes: store.notes,
      };
      if (!user) {
        payload.guest_name = store.guestName;
        payload.guest_email = store.guestEmail;
        payload.guest_phone = store.guestPhone;
      }
      const { data } = await api.post('/reservations', payload);
      setConfirmationNo(data.reservation.reservation_no);
      store.setStep(6);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create reservation');
    }
    setSubmitting(false);
  };

  const slideVariants = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  // Confirmation screen
  if (store.step === 6) {
    return (
      <div className="pt-24 pb-16 px-6 min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h1 className="font-outfit font-bold text-3xl text-white mb-2">Reservation Confirmed!</h1>
          <p className="text-text-secondary mb-6">Your reservation number is:</p>
          <p className="font-outfit font-bold text-2xl text-accent mb-8">{confirmationNo}</p>
          <p className="text-text-muted text-sm mb-8">
            We&apos;ll contact you shortly to confirm the details. Check your email for the receipt.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => { store.reset(); router.push('/'); }}>Back to Home</Button>
            <a href={`https://wa.me/38344123456?text=Hi, my reservation number is ${confirmationNo}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">WhatsApp Us</Button>
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-outfit font-bold text-3xl text-white text-center mb-2">Reserve Your Car</h1>
        <p className="text-text-secondary text-center mb-8">Complete the steps below to book your vehicle.</p>

        <StepIndicator current={store.step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={store.step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {/* Step 1: Dates & Location */}
            {store.step === 1 && (
              <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-6">
                <h2 className="font-outfit font-semibold text-white text-xl">Select Dates & Location</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Pickup Location
                    </label>
                    <select
                      value={store.pickupLocation}
                      onChange={e => store.setDates({ pickupLocation: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                    >
                      <option value="">Select location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Dropoff Location
                    </label>
                    <select
                      value={store.dropoffLocation}
                      onChange={e => store.setDates({ dropoffLocation: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                    >
                      <option value="">Select location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Pickup Date
                    </label>
                    <input
                      type="date"
                      value={store.pickupDate}
                      onChange={e => store.setDates({ pickupDate: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Return Date
                    </label>
                    <input
                      type="date"
                      value={store.dropoffDate}
                      onChange={e => store.setDates({ dropoffDate: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Pickup Time
                    </label>
                    <input
                      type="time"
                      value={store.pickupTime}
                      onChange={e => store.setDates({ pickupTime: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted text-xs font-medium mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Return Time
                    </label>
                    <input
                      type="time"
                      value={store.dropoffTime}
                      onChange={e => store.setDates({ dropoffTime: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Choose Car */}
            {store.step === 2 && (
              <div className="space-y-6">
                <h2 className="font-outfit font-semibold text-white text-xl">Choose Your Car</h2>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cars.map(car => (
                      <button
                        key={car.id}
                        onClick={() => store.setCarId(car.id)}
                        className={`text-left rounded-xl border-2 transition-colors ${
                          store.selectedCarId === car.id ? 'border-accent' : 'border-transparent'
                        }`}
                      >
                        <CarCard car={car} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Extras */}
            {store.step === 3 && (
              <div className="space-y-6">
                <h2 className="font-outfit font-semibold text-white text-xl">Select Extras</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extras.map(ext => {
                    const isSelected = store.selectedExtras.some(e => e.extra_id === ext.id);
                    return (
                      <button
                        key={ext.id}
                        onClick={() => store.toggleExtra(ext.id)}
                        className={`p-5 rounded-xl border-2 text-left transition-all ${
                          isSelected ? 'border-accent bg-accent/5' : 'border-border bg-bg-secondary hover:border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white">{ext.name}</h4>
                          <span className="text-accent font-bold">{formatPrice(Number(ext.price_per_day))}/day</span>
                        </div>
                        <p className="text-text-secondary text-sm">{ext.description}</p>
                        {isSelected && totalDays > 0 && (
                          <p className="text-accent text-xs mt-2">
                            Total: {formatPrice(Number(ext.price_per_day) * totalDays)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Personal Details */}
            {store.step === 4 && (
              <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-6">
                <h2 className="font-outfit font-semibold text-white text-xl">Your Details</h2>
                {user ? (
                  <div className="p-4 bg-bg-tertiary rounded-lg">
                    <p className="text-white font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-text-secondary text-sm">{user.email}</p>
                    {user.phone && <p className="text-text-secondary text-sm">{user.phone}</p>}
                    <p className="text-success text-xs mt-2">Logged in - details will be used automatically</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-text-muted text-sm">
                      <a href="/auth/login" className="text-accent hover:underline">Login</a> for a faster checkout, or continue as guest:
                    </p>
                    <Input
                      label="Full Name"
                      value={store.guestName}
                      onChange={e => store.setGuest({ guestName: e.target.value })}
                      placeholder="Your full name"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={store.guestEmail}
                      onChange={e => store.setGuest({ guestEmail: e.target.value })}
                      placeholder="your@email.com"
                    />
                    <Input
                      label="Phone"
                      value={store.guestPhone}
                      onChange={e => store.setGuest({ guestPhone: e.target.value })}
                      placeholder="+383 44 ..."
                    />
                  </div>
                )}
                <div>
                  <label className="text-text-muted text-xs font-medium mb-1.5 block">Notes (optional)</label>
                  <textarea
                    value={store.notes}
                    onChange={e => store.setGuest({ notes: e.target.value })}
                    rows={3}
                    placeholder="Any special requests..."
                    className="w-full bg-surface border border-border rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {store.step === 5 && (
              <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-6">
                <h2 className="font-outfit font-semibold text-white text-xl">Review Your Reservation</h2>

                {selectedCar && (
                  <div className="flex gap-4 p-4 bg-bg-tertiary rounded-lg">
                    <div className="flex-1">
                      <p className="font-outfit font-bold text-white text-lg">{selectedCar.brand} {selectedCar.model}</p>
                      <p className="text-text-muted text-sm">{selectedCar.year} &middot; {selectedCar.category}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Pickup</span>
                    <span className="text-white">{store.pickupDate} at {store.pickupTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Return</span>
                    <span className="text-white">{store.dropoffDate} at {store.dropoffTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Duration</span>
                    <span className="text-white">{totalDays} day{totalDays !== 1 ? 's' : ''}</span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Daily Rate</span>
                    <span className="text-white">{selectedCar ? formatPrice(Number(selectedCar.price_per_day)) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Base ({totalDays} days)</span>
                    <span className="text-white">{formatPrice(basePrice)}</span>
                  </div>
                  {store.selectedExtras.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Extras</span>
                      <span className="text-white">{formatPrice(extrasPrice)}</span>
                    </div>
                  )}
                  <hr className="border-border" />
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-accent">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => store.setStep(Math.max(1, store.step - 1))}
            disabled={store.step === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          {store.step < 5 ? (
            <Button
              onClick={() => store.setStep(store.step + 1)}
              disabled={!canProceed()}
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canProceed()}
            >
              Confirm Reservation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
