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

// === EXPENSE TRACKING ===
export interface CarExpense {
  id: string;
  car_id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string;
  vendor: string | null;
  created_by: string | null;
  created_at: string;
  car_brand?: string;
  car_model?: string;
}

export type ExpenseCategory = 'insurance' | 'repair' | 'fuel' | 'tire' | 'wash' | 'parking' | 'tax' | 'registration' | 'other';

// === MAINTENANCE SCHEDULER ===
export interface MaintenanceType {
  id: string;
  name: string;
  description: string | null;
  interval_km: number | null;
  interval_days: number | null;
  estimated_cost: number | null;
  is_active: boolean;
}

export interface MaintenanceRecord {
  id: string;
  car_id: string;
  maintenance_type_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  scheduled_date: string | null;
  completed_date: string | null;
  mileage_at_service: number | null;
  next_due_mileage: number | null;
  next_due_date: string | null;
  cost: number | null;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  type_name?: string;
  car_brand?: string;
  car_model?: string;
}

// === DYNAMIC PRICING ===
export interface PricingRule {
  id: string;
  name: string;
  type: 'demand' | 'advance_booking' | 'duration' | 'last_minute' | 'event';
  car_id: string | null;
  category: string | null;
  multiplier: number;
  conditions: Record<string, number>;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

// === LOYALTY PROGRAM ===
export interface LoyaltyAccount {
  id: string;
  user_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface LoyaltyTransaction {
  id: string;
  account_id: string;
  reservation_id: string | null;
  type: 'earn' | 'redeem' | 'bonus' | 'expire' | 'adjust';
  points: number;
  description: string | null;
  created_at: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  type: 'discount_percent' | 'discount_fixed' | 'free_day' | 'upgrade' | 'free_extra';
  value: number;
  points_cost: number;
  is_active: boolean;
  min_tier: LoyaltyTier;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// === NOTIFICATIONS ===
export interface NotificationTemplate {
  id: string;
  type: string;
  channel: 'whatsapp' | 'email' | 'sms';
  template_name: string;
  template_body: string;
  is_active: boolean;
}

export interface NotificationLog {
  id: string;
  reservation_id: string | null;
  user_id: string | null;
  type: string;
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  customer_name?: string;
  reservation_no?: string;
}

// === DELIVERY TRACKING ===
export interface DeliveryAssignment {
  id: string;
  reservation_id: string;
  driver_id: string;
  type: 'delivery' | 'return_pickup';
  status: 'assigned' | 'en_route' | 'arrived' | 'completed' | 'cancelled';
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_arrival: string | null;
  notes: string | null;
  created_at: string;
  driver_name?: string;
  driver_phone?: string;
  reservation_no?: string;
  customer_name?: string;
  car_name?: string;
}

export interface DriverLocation {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
}

export type CarCategory = 'economy' | 'compact' | 'sedan' | 'suv' | 'luxury' | 'van' | 'sports';
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type TransmissionType = 'manual' | 'automatic';
export type ReservationStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'rejected';
