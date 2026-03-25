export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: 'customer' | 'staff' | 'manager' | 'owner';
}

export interface Car {
  id: string;
  brand: string;
  model: string;
  year: number;
  slug: string;
  category: CarCategory;
  fuel: FuelType;
  transmission: TransmissionType;
  seats: number;
  doors: number;
  horsepower: number;
  engine_cc: number;
  color: string;
  mileage: number;
  price_per_day: number;
  price_per_week: number | null;
  deposit: number;
  description: string;
  features: string[];
  is_available: boolean;
  is_featured: boolean;
  image?: string;
  images?: CarImage[];
  reviews?: Review[];
  avg_rating: number;
  review_count: number;
}

export interface CarImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

export interface Extra {
  id: string;
  name: string;
  description: string;
  price_per_day: number;
  icon: string;
}

export interface Reservation {
  id: string;
  reservation_no: string;
  user_id: string | null;
  car_id: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  status: ReservationStatus;
  total_days: number;
  daily_rate: number;
  extras_total: number;
  discount: number;
  total_price: number;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  brand?: string;
  model?: string;
  slug?: string;
  car_image?: string;
  pickup_location_name?: string;
  dropoff_location_name?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  extras?: ReservationExtra[];
}

export interface ReservationExtra {
  id: string;
  extra_id: string;
  name: string;
  icon: string;
  quantity: number;
  price: number;
}

export interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover_image: string | null;
  author_name: string;
  is_published: boolean;
  published_at: string;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type CarCategory = 'economy' | 'compact' | 'sedan' | 'suv' | 'luxury' | 'van' | 'sports';
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type TransmissionType = 'manual' | 'automatic';
export type ReservationStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'rejected';
