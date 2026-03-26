-- MySQL Schema for Drenas Rent a Car

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  role ENUM('customer', 'staff', 'manager', 'owner') DEFAULT 'customer',
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cars (
  id CHAR(36) PRIMARY KEY,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  category ENUM('economy', 'compact', 'sedan', 'suv', 'luxury', 'van', 'sports') NOT NULL,
  fuel ENUM('petrol', 'diesel', 'hybrid', 'electric') NOT NULL,
  transmission ENUM('manual', 'automatic') NOT NULL,
  seats INT DEFAULT 5,
  doors INT DEFAULT 4,
  horsepower INT,
  engine_cc INT,
  color VARCHAR(50),
  license_plate VARCHAR(20) UNIQUE,
  vin VARCHAR(17) UNIQUE,
  mileage INT DEFAULT 0,
  price_per_day DECIMAL(10,2) NOT NULL,
  price_per_week DECIMAL(10,2),
  deposit DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  features JSON,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cars_available (is_available),
  INDEX idx_cars_category (category),
  INDEX idx_cars_price (price_per_day),
  INDEX idx_cars_slug (slug),
  FULLTEXT INDEX idx_cars_search (brand, model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_images (
  id CHAR(36) PRIMARY KEY,
  car_id CHAR(36) NOT NULL,
  url TEXT NOT NULL,
  alt_text VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_car_images_car (car_id),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS locations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  is_active BOOLEAN DEFAULT true
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS extras (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_per_day DECIMAL(10,2) NOT NULL,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id CHAR(36) PRIMARY KEY,
  reservation_no VARCHAR(20) UNIQUE NOT NULL,
  user_id CHAR(36),
  car_id CHAR(36) NOT NULL,
  pickup_location CHAR(36),
  dropoff_location CHAR(36),
  pickup_date DATETIME NOT NULL,
  dropoff_date DATETIME NOT NULL,
  status ENUM('pending', 'confirmed', 'active', 'completed', 'cancelled', 'rejected') DEFAULT 'pending',
  total_days INT NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  extras_total DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  guest_name VARCHAR(200),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(30),
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_res_status (status),
  INDEX idx_res_dates (pickup_date, dropoff_date),
  INDEX idx_res_car (car_id),
  INDEX idx_res_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (car_id) REFERENCES cars(id),
  FOREIGN KEY (pickup_location) REFERENCES locations(id),
  FOREIGN KEY (dropoff_location) REFERENCES locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservation_extras (
  id CHAR(36) PRIMARY KEY,
  reservation_id CHAR(36) NOT NULL,
  extra_id CHAR(36) NOT NULL,
  quantity INT DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (extra_id) REFERENCES extras(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasonal_pricing (
  id CHAR(36) PRIMARY KEY,
  car_id CHAR(36),
  name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  multiplier DECIMAL(4,2) DEFAULT 1.00,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  reservation_id CHAR(36) UNIQUE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_posts (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt VARCHAR(500),
  cover_image TEXT,
  author_id CHAR(36),
  is_published BOOLEAN DEFAULT false,
  published_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  subject VARCHAR(300),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
