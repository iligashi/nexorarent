-- Migration 002: All 7 new features
-- Reviews enhancement, Expenses, Maintenance, Dynamic Pricing, Loyalty, Notifications, Delivery Tracking

-- =============================================
-- 1. REVIEW SYSTEM ENHANCEMENTS
-- =============================================
ALTER TABLE reviews ADD COLUMN admin_reply TEXT AFTER is_approved;
ALTER TABLE reviews ADD COLUMN replied_at TIMESTAMP NULL AFTER admin_reply;

-- =============================================
-- 2. EXPENSE TRACKING PER CAR
-- =============================================
CREATE TABLE IF NOT EXISTS car_expenses (
  id CHAR(36) PRIMARY KEY,
  car_id CHAR(36) NOT NULL,
  category ENUM('insurance','repair','fuel','tire','wash','parking','tax','registration','other') NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  vendor VARCHAR(200),
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expense_car (car_id),
  INDEX idx_expense_date (expense_date),
  INDEX idx_expense_category (category),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. MAINTENANCE SCHEDULER
-- =============================================
CREATE TABLE IF NOT EXISTS maintenance_types (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  interval_km INT,
  interval_days INT,
  estimated_cost DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_records (
  id CHAR(36) PRIMARY KEY,
  car_id CHAR(36) NOT NULL,
  maintenance_type_id CHAR(36) NOT NULL,
  status ENUM('scheduled','in_progress','completed','cancelled','overdue') DEFAULT 'scheduled',
  scheduled_date DATE,
  completed_date DATE,
  mileage_at_service INT,
  next_due_mileage INT,
  next_due_date DATE,
  cost DECIMAL(10,2),
  vendor VARCHAR(200),
  notes TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_maint_car (car_id),
  INDEX idx_maint_status (status),
  INDEX idx_maint_due (next_due_date),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (maintenance_type_id) REFERENCES maintenance_types(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. DYNAMIC PRICING
-- =============================================
CREATE TABLE IF NOT EXISTS pricing_rules (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type ENUM('demand','advance_booking','duration','last_minute','event') NOT NULL,
  car_id CHAR(36),
  category VARCHAR(50),
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  conditions JSON NOT NULL,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pricing_active (is_active, start_date, end_date),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. LOYALTY PROGRAM
-- =============================================
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) UNIQUE NOT NULL,
  points_balance INT DEFAULT 0,
  lifetime_points INT DEFAULT 0,
  tier ENUM('bronze','silver','gold','platinum') DEFAULT 'bronze',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id CHAR(36) PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  reservation_id CHAR(36),
  type ENUM('earn','redeem','bonus','expire','adjust') NOT NULL,
  points INT NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_loyalty_tx_account (account_id),
  FOREIGN KEY (account_id) REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type ENUM('discount_percent','discount_fixed','free_day','upgrade','free_extra') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  points_cost INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  min_tier ENUM('bronze','silver','gold','platinum') DEFAULT 'bronze'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE reservations ADD COLUMN loyalty_points_earned INT DEFAULT 0;
ALTER TABLE reservations ADD COLUMN loyalty_points_redeemed INT DEFAULT 0;

-- =============================================
-- 6. WHATSAPP / NOTIFICATION SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id CHAR(36) PRIMARY KEY,
  type ENUM('booking_confirmation','pickup_reminder','return_reminder','review_request','status_change','loyalty_points') NOT NULL,
  channel ENUM('whatsapp','email','sms') NOT NULL DEFAULT 'whatsapp',
  template_name VARCHAR(200) NOT NULL,
  template_body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE KEY uq_template_type_channel (type, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_log (
  id CHAR(36) PRIMARY KEY,
  reservation_id CHAR(36),
  user_id CHAR(36),
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  status ENUM('pending','sent','delivered','failed','read') DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_status (status),
  INDEX idx_notif_reservation (reservation_id),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. DELIVERY & RETURN TRACKING
-- =============================================
ALTER TABLE users MODIFY COLUMN role ENUM('customer','staff','manager','owner','driver') DEFAULT 'customer';

CREATE TABLE IF NOT EXISTS delivery_assignments (
  id CHAR(36) PRIMARY KEY,
  reservation_id CHAR(36) NOT NULL,
  driver_id CHAR(36) NOT NULL,
  type ENUM('delivery','return_pickup') NOT NULL,
  status ENUM('assigned','en_route','arrived','completed','cancelled') DEFAULT 'assigned',
  pickup_lat DECIMAL(10,7),
  pickup_lng DECIMAL(10,7),
  destination_lat DECIMAL(10,7),
  destination_lng DECIMAL(10,7),
  destination_address TEXT,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  estimated_arrival TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_delivery_reservation (reservation_id),
  INDEX idx_delivery_driver (driver_id),
  INDEX idx_delivery_status (status),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS driver_locations (
  id CHAR(36) PRIMARY KEY,
  driver_id CHAR(36) NOT NULL,
  assignment_id CHAR(36) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  speed DECIMAL(6,2),
  heading DECIMAL(5,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_driver_loc_assignment (assignment_id),
  INDEX idx_driver_loc_time (recorded_at),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (assignment_id) REFERENCES delivery_assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- SEED: Default maintenance types
-- =============================================
INSERT IGNORE INTO maintenance_types (id, name, description, interval_km, interval_days, estimated_cost) VALUES
  (UUID(), 'Oil Change', 'Engine oil and filter replacement', 10000, 180, 50.00),
  (UUID(), 'Tire Rotation', 'Rotate tires for even wear', 12000, 180, 30.00),
  (UUID(), 'Brake Inspection', 'Check brake pads, rotors and fluid', 20000, 365, 80.00),
  (UUID(), 'Air Filter', 'Replace engine air filter', 20000, 365, 25.00),
  (UUID(), 'Full Inspection', 'Complete vehicle safety inspection', NULL, 365, 150.00),
  (UUID(), 'Tire Replacement', 'Replace all four tires', 50000, NULL, 400.00),
  (UUID(), 'Battery Check', 'Test and replace battery if needed', NULL, 365, 100.00),
  (UUID(), 'AC Service', 'Air conditioning check and recharge', NULL, 365, 60.00);

-- =============================================
-- SEED: Default notification templates
-- =============================================
INSERT IGNORE INTO notification_templates (id, type, channel, template_name, template_body) VALUES
  (UUID(), 'booking_confirmation', 'whatsapp', 'Booking Confirmed', 'Hi {{customer_name}}! Your reservation #{{reservation_no}} for {{car_name}} has been confirmed.\n\nPickup: {{pickup_date}} at {{pickup_location}}\nReturn: {{dropoff_date}}\nTotal: {{total_price}}\n\nThank you for choosing Nexora Rent a Car!'),
  (UUID(), 'pickup_reminder', 'whatsapp', 'Pickup Reminder', 'Hi {{customer_name}}! Reminder: Your car pickup is tomorrow.\n\nCar: {{car_name}}\nDate: {{pickup_date}}\nLocation: {{pickup_location}}\n\nSee you soon!'),
  (UUID(), 'return_reminder', 'whatsapp', 'Return Reminder', 'Hi {{customer_name}}! Reminder: Your car return is tomorrow.\n\nCar: {{car_name}}\nReturn Date: {{dropoff_date}}\nLocation: {{dropoff_location}}\n\nThank you!'),
  (UUID(), 'review_request', 'whatsapp', 'Review Request', 'Hi {{customer_name}}! Thank you for renting with us. We hope you enjoyed your {{car_name}}.\n\nWe would love your feedback! Please leave a review on our website.\n\nNexora Rent a Car'),
  (UUID(), 'status_change', 'whatsapp', 'Status Update', 'Hi {{customer_name}}! Your reservation #{{reservation_no}} status has been updated to: {{status}}.\n\nNexora Rent a Car');

-- =============================================
-- SEED: Default loyalty rewards
-- =============================================
INSERT IGNORE INTO loyalty_rewards (id, name, description, type, value, points_cost, min_tier) VALUES
  (UUID(), '5% Discount', 'Get 5% off your next rental', 'discount_percent', 5.00, 100, 'bronze'),
  (UUID(), '10% Discount', 'Get 10% off your next rental', 'discount_percent', 10.00, 200, 'silver'),
  (UUID(), 'Free Extra Day', 'Get one free extra day on your rental', 'free_day', 1.00, 300, 'silver'),
  (UUID(), '20% Discount', 'Get 20% off your next rental', 'discount_percent', 20.00, 500, 'gold'),
  (UUID(), 'Free Upgrade', 'Upgrade to next car category for free', 'upgrade', 1.00, 400, 'gold'),
  (UUID(), '€25 Off', 'Get €25 off your next rental', 'discount_fixed', 25.00, 250, 'bronze');

-- =============================================
-- SEED: Default pricing rules
-- =============================================
INSERT IGNORE INTO pricing_rules (id, name, type, car_id, category, multiplier, conditions, priority, is_active) VALUES
  (UUID(), 'High Demand Surge', 'demand', NULL, NULL, 1.25, '{"min_demand_percent": 80}', 10, true),
  (UUID(), 'Very High Demand', 'demand', NULL, NULL, 1.40, '{"min_demand_percent": 95}', 20, true),
  (UUID(), 'Last Minute Booking', 'last_minute', NULL, NULL, 1.15, '{"days_before_pickup_max": 1}', 5, true),
  (UUID(), 'Early Bird Discount', 'advance_booking', NULL, NULL, 0.90, '{"days_before_pickup_min": 14}', 5, true),
  (UUID(), 'Weekly Discount', 'duration', NULL, NULL, 0.85, '{"min_days": 7}', 3, true);
