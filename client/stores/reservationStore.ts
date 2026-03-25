import { create } from 'zustand';

interface ReservationState {
  step: number;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  dropoffDate: string;
  pickupTime: string;
  dropoffTime: string;
  selectedCarId: string | null;
  selectedExtras: { extra_id: string; quantity: number }[];
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  notes: string;
  setStep: (step: number) => void;
  setDates: (data: Partial<ReservationState>) => void;
  setCarId: (id: string) => void;
  toggleExtra: (extraId: string) => void;
  setGuest: (data: Partial<ReservationState>) => void;
  reset: () => void;
}

const initial = {
  step: 1,
  pickupLocation: '',
  dropoffLocation: '',
  pickupDate: '',
  dropoffDate: '',
  pickupTime: '10:00',
  dropoffTime: '10:00',
  selectedCarId: null,
  selectedExtras: [] as { extra_id: string; quantity: number }[],
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  notes: '',
};

export const useReservationStore = create<ReservationState>((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setDates: (data) => set(data),
  setCarId: (id) => set({ selectedCarId: id }),
  toggleExtra: (extraId) =>
    set((state) => {
      const exists = state.selectedExtras.find((e) => e.extra_id === extraId);
      if (exists) {
        return { selectedExtras: state.selectedExtras.filter((e) => e.extra_id !== extraId) };
      }
      return { selectedExtras: [...state.selectedExtras, { extra_id: extraId, quantity: 1 }] };
    }),
  setGuest: (data) => set(data),
  reset: () => set(initial),
}));
