import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';
import 'dotenv/config';

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drenas_rentacar',
  });

  try {
    // Owner user
    const passwordHash = await bcrypt.hash('admin123', 12);
    const adminId = uuidv4();
    await conn.execute(
      `INSERT IGNORE INTO users (id, email, password_hash, first_name, last_name, phone, role, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, true)`,
      [adminId, 'admin@nexorarentacar.com', passwordHash, 'Admin', 'Drenas', '+383 44 123 456', 'owner']
    );

    // Locations
    const locations = [
      ['Drenas Center', 'Rruga Adem Jashari, Drenas', 'Drenas', 42.6271, 20.8900],
      ['Pristina Airport', 'Pristina International Airport Adem Jashari', 'Pristina', 42.5728, 21.0358],
      ['Pristina City Center', 'Bulevardi Nënë Tereza, Pristina', 'Pristina', 42.6629, 21.1655],
      ['Skopje Airport', 'Alexander the Great Airport, Skopje', 'Skopje', 41.9617, 21.6214],
      ['Peja Center', 'Rruga Mbretëresha Teutë, Peja', 'Peja', 42.6593, 20.2888],
    ];
    for (const [name, address, city, lat, lng] of locations) {
      await conn.execute(
        `INSERT IGNORE INTO locations (id, name, address, city, lat, lng) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), name, address, city, lat, lng]
      );
    }

    // Cars
    const cars = [
      ['Mercedes-Benz', 'C-Class', 2023, 'mercedes-c-class-2023', 'luxury', 'diesel', 'automatic', 5, 4, 200, 1993, 'Black', '02-234-BB', null, 20000, 85, 500, 300, 'Elegant Mercedes C-Class with premium interior and advanced tech.', '["GPS","AC","Bluetooth","USB","Leather Seats","Cruise Control","Parking Sensors","Heated Seats","Sunroof"]', true, true],
      ['BMW', '3 Series', 2022, 'bmw-3-series-2022', 'sedan', 'diesel', 'automatic', 5, 4, 190, 1995, 'Grey', '03-345-CC', null, 25000, 75, 450, 250, 'Sporty BMW 3 Series with dynamic handling.', '["GPS","AC","Bluetooth","USB","Leather Seats","Cruise Control","Parking Sensors","Sport Mode"]', true, true],
      ['Toyota', 'RAV4', 2023, 'toyota-rav4-2023', 'suv', 'hybrid', 'automatic', 5, 4, 222, 2487, 'Silver', '04-456-DD', null, 10000, 55, 330, 200, 'Reliable Toyota RAV4 hybrid - perfect for Kosovo roads.', '["GPS","AC","Bluetooth","USB","Cruise Control","Parking Sensors","All-Wheel Drive","Apple CarPlay"]', true, false],
      ['Audi', 'A4', 2022, 'audi-a4-2022', 'sedan', 'diesel', 'automatic', 5, 4, 190, 1968, 'Blue', '05-567-EE', null, 30000, 70, 420, 250, 'Refined Audi A4 with quattro-like precision.', '["GPS","AC","Bluetooth","USB","Leather Seats","Cruise Control","Parking Sensors","Virtual Cockpit"]', true, false],
      ['Peugeot', '208', 2023, 'peugeot-208-2023', 'economy', 'petrol', 'manual', 5, 4, 100, 1199, 'Red', '06-678-FF', null, 8000, 25, 150, 75, 'Stylish and fuel-efficient Peugeot 208 for city adventures.', '["AC","Bluetooth","USB","Parking Sensors"]', true, false],
      ['Skoda', 'Octavia', 2023, 'skoda-octavia-2023', 'compact', 'diesel', 'manual', 5, 4, 150, 1968, 'White', '07-789-GG', null, 18000, 35, 210, 100, 'Spacious Skoda Octavia - great value and comfort.', '["GPS","AC","Bluetooth","USB","Cruise Control","Parking Sensors","Apple CarPlay"]', true, false],
      ['Mercedes-Benz', 'GLE Coupe', 2023, 'mercedes-gle-coupe-2023', 'luxury', 'diesel', 'automatic', 5, 4, 330, 2925, 'Black', '08-890-HH', null, 15000, 120, 720, 500, 'The stunning Mercedes GLE Coupe - luxury meets performance.', '["GPS","AC","Bluetooth","USB","Leather Seats","Cruise Control","Parking Sensors","Heated Seats","Sunroof","360 Camera","Ambient Lighting"]', true, true],
      ['Volkswagen', 'Tiguan', 2022, 'volkswagen-tiguan-2022', 'suv', 'diesel', 'automatic', 5, 4, 150, 1968, 'Grey', '09-901-II', null, 22000, 50, 300, 150, 'Versatile VW Tiguan - ideal for family trips.', '["GPS","AC","Bluetooth","USB","Cruise Control","Parking Sensors","Apple CarPlay","All-Wheel Drive"]', true, false],
      ['Renault', 'Clio', 2023, 'renault-clio-2023', 'economy', 'petrol', 'manual', 5, 4, 90, 999, 'Orange', '10-012-JJ', null, 5000, 25, 150, 75, 'Compact Renault Clio - nimble and economical.', '["AC","Bluetooth","USB","Parking Sensors"]', true, false],
      ['Ford', 'Focus', 2022, 'ford-focus-2022', 'compact', 'petrol', 'manual', 5, 4, 125, 1498, 'Blue', '11-123-KK', null, 20000, 30, 180, 100, 'Dynamic Ford Focus with sporty handling.', '["GPS","AC","Bluetooth","USB","Cruise Control","Parking Sensors"]', true, false],
    ];

    for (const c of cars) {
      const id = uuidv4();
      await conn.execute(`
        INSERT IGNORE INTO cars (id, brand, model, year, slug, category, fuel, transmission, seats, doors, horsepower, engine_cc, color, license_plate, vin, mileage, price_per_day, price_per_week, deposit, description, features, is_available, is_featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, ...c]);
    }

    // Extras
    const extras = [
      ['GPS Navigation', 'Portable GPS device with Kosovo maps', 5, 'navigation'],
      ['Child Seat', 'ISOFIX child safety seat (0-12 years)', 3, 'baby'],
      ['Full Insurance', 'Zero deductible comprehensive insurance', 8, 'shield'],
      ['Additional Driver', 'Register an additional driver', 10, 'user-plus'],
    ];
    for (const [name, description, price, icon] of extras) {
      await conn.execute(
        `INSERT IGNORE INTO extras (id, name, description, price_per_day, icon) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), name, description, price, icon]
      );
    }

    // Settings
    const settings = [
      ['company_name', JSON.stringify('Nexora Rent a Car')],
      ['company_phone', JSON.stringify('+383 44 123 456')],
      ['company_email', JSON.stringify('info@nexorarentacar.com')],
      ['company_address', JSON.stringify('Rruga Adem Jashari, Drenas, Kosovo')],
      ['working_hours_weekday', JSON.stringify('08:00 - 20:00')],
      ['working_hours_weekend', JSON.stringify('09:00 - 18:00')],
      ['currency', JSON.stringify('EUR')],
    ];
    for (const [key, value] of settings) {
      await conn.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [key, value]
      );
    }

    console.log('Seed data inserted successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    await conn.end();
  }
}

seed().catch(() => process.exit(1));
