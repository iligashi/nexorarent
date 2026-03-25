import bcrypt from 'bcryptjs';
import pool from '../pool.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Owner user
    const passwordHash = await bcrypt.hash('admin123', 12);
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@drenasrentacar.com', passwordHash, 'Admin', 'Drenas', '+383 44 123 456', 'owner']);

    // Locations
    const locations = [
      ['Drenas Center', 'Rruga Adem Jashari, Drenas', 'Drenas', 42.6271, 20.8900],
      ['Pristina Airport', 'Pristina International Airport Adem Jashari', 'Pristina', 42.5728, 21.0358],
      ['Pristina City Center', 'Bulevardi Nënë Tereza, Pristina', 'Pristina', 42.6629, 21.1655],
      ['Skopje Airport', 'Alexander the Great Airport, Skopje', 'Skopje', 41.9617, 21.6214],
      ['Peja Center', 'Rruga Mbretëresha Teutë, Peja', 'Peja', 42.6593, 20.2888],
    ];
    for (const [name, address, city, lat, lng] of locations) {
      await client.query(
        `INSERT INTO locations (name, address, city, lat, lng) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [name, address, city, lat, lng]
      );
    }

    // Cars
    const cars = [
      ['Volkswagen', 'Golf 8', 2023, 'volkswagen-golf-8-2023', 'compact', 'petrol', 'manual', 5, 4, 150, 1498, 'White', '01-123-AA', null, 15000, 30, 180, 100, 'The iconic VW Golf 8 - perfect for city driving and highway comfort.', '{GPS,AC,Bluetooth,USB,"Cruise Control","Parking Sensors"}', true, true],
      ['Mercedes-Benz', 'C-Class', 2023, 'mercedes-c-class-2023', 'luxury', 'diesel', 'automatic', 5, 4, 200, 1993, 'Black', '02-234-BB', null, 20000, 85, 500, 300, 'Elegant Mercedes C-Class with premium interior and advanced tech.', '{GPS,AC,Bluetooth,USB,"Leather Seats","Cruise Control","Parking Sensors","Heated Seats","Sunroof"}', true, true],
      ['BMW', '3 Series', 2022, 'bmw-3-series-2022', 'sedan', 'diesel', 'automatic', 5, 4, 190, 1995, 'Grey', '03-345-CC', null, 25000, 75, 450, 250, 'Sporty BMW 3 Series with dynamic handling.', '{GPS,AC,Bluetooth,USB,"Leather Seats","Cruise Control","Parking Sensors","Sport Mode"}', true, true],
      ['Toyota', 'RAV4', 2023, 'toyota-rav4-2023', 'suv', 'hybrid', 'automatic', 5, 4, 222, 2487, 'Silver', '04-456-DD', null, 10000, 55, 330, 200, 'Reliable Toyota RAV4 hybrid - perfect for Kosovo roads.', '{GPS,AC,Bluetooth,USB,"Cruise Control","Parking Sensors","All-Wheel Drive","Apple CarPlay"}', true, false],
      ['Audi', 'A4', 2022, 'audi-a4-2022', 'sedan', 'diesel', 'automatic', 5, 4, 190, 1968, 'Blue', '05-567-EE', null, 30000, 70, 420, 250, 'Refined Audi A4 with quattro-like precision.', '{GPS,AC,Bluetooth,USB,"Leather Seats","Cruise Control","Parking Sensors","Virtual Cockpit"}', true, false],
      ['Peugeot', '208', 2023, 'peugeot-208-2023', 'economy', 'petrol', 'manual', 5, 4, 100, 1199, 'Red', '06-678-FF', null, 8000, 25, 150, 75, 'Stylish and fuel-efficient Peugeot 208 for city adventures.', '{AC,Bluetooth,USB,"Parking Sensors"}', true, false],
      ['Skoda', 'Octavia', 2023, 'skoda-octavia-2023', 'compact', 'diesel', 'manual', 5, 4, 150, 1968, 'White', '07-789-GG', null, 18000, 35, 210, 100, 'Spacious Skoda Octavia - great value and comfort.', '{GPS,AC,Bluetooth,USB,"Cruise Control","Parking Sensors","Apple CarPlay"}', true, false],
      ['Mercedes-Benz', 'GLE Coupe', 2023, 'mercedes-gle-coupe-2023', 'luxury', 'diesel', 'automatic', 5, 4, 330, 2925, 'Black', '08-890-HH', null, 15000, 120, 720, 500, 'The stunning Mercedes GLE Coupe - luxury meets performance.', '{GPS,AC,Bluetooth,USB,"Leather Seats","Cruise Control","Parking Sensors","Heated Seats","Sunroof","360 Camera","Ambient Lighting"}', true, true],
      ['Volkswagen', 'Tiguan', 2022, 'volkswagen-tiguan-2022', 'suv', 'diesel', 'automatic', 5, 4, 150, 1968, 'Grey', '09-901-II', null, 22000, 50, 300, 150, 'Versatile VW Tiguan - ideal for family trips.', '{GPS,AC,Bluetooth,USB,"Cruise Control","Parking Sensors","Apple CarPlay","All-Wheel Drive"}', true, false],
      ['Renault', 'Clio', 2023, 'renault-clio-2023', 'economy', 'petrol', 'manual', 5, 4, 90, 999, 'Orange', '10-012-JJ', null, 5000, 25, 150, 75, 'Compact Renault Clio - nimble and economical.', '{AC,Bluetooth,USB,"Parking Sensors"}', true, false],
      ['Ford', 'Focus', 2022, 'ford-focus-2022', 'compact', 'petrol', 'manual', 5, 4, 125, 1498, 'Blue', '11-123-KK', null, 20000, 30, 180, 100, 'Dynamic Ford Focus with sporty handling.', '{GPS,AC,Bluetooth,USB,"Cruise Control","Parking Sensors"}', true, false],
      ['Audi', 'Q7', 2023, 'audi-q7-2023', 'suv', 'diesel', 'automatic', 7, 4, 286, 2967, 'Black', '12-234-LL', null, 12000, 100, 600, 400, 'Commanding Audi Q7 - 7 seats of luxury.', '{GPS,AC,Bluetooth,USB,"Leather Seats","Cruise Control","Parking Sensors","Heated Seats","Panoramic Roof","Virtual Cockpit","All-Wheel Drive"}', true, true],
    ];

    for (const c of cars) {
      await client.query(`
        INSERT INTO cars (brand, model, year, slug, category, fuel, transmission, seats, doors, horsepower, engine_cc, color, license_plate, vin, mileage, price_per_day, price_per_week, deposit, description, features, is_available, is_featured)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (slug) DO NOTHING
      `, c);
    }

    // Extras
    const extras = [
      ['GPS Navigation', 'Portable GPS device with Kosovo maps', 5, 'navigation'],
      ['Child Seat', 'ISOFIX child safety seat (0-12 years)', 3, 'baby'],
      ['Full Insurance', 'Zero deductible comprehensive insurance', 8, 'shield'],
      ['Additional Driver', 'Register an additional driver', 10, 'user-plus'],
    ];
    for (const [name, description, price, icon] of extras) {
      await client.query(
        `INSERT INTO extras (name, description, price_per_day, icon) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [name, description, price, icon]
      );
    }

    // Settings
    const settings = [
      ['company_name', '"Drenas Rent a Car"'],
      ['company_phone', '"+383 44 123 456"'],
      ['company_email', '"info@drenasrentacar.com"'],
      ['company_address', '"Rruga Adem Jashari, Drenas, Kosovo"'],
      ['working_hours', '{"mon_fri": "08:00-20:00", "saturday": "09:00-18:00", "sunday": "10:00-16:00"}'],
      ['social_links', '{"facebook": "https://facebook.com/drenasrentacar", "instagram": "https://instagram.com/drenasrentacar", "whatsapp": "+38344123456"}'],
      ['currency', '"EUR"'],
    ];
    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = $2::jsonb`,
        [key, value]
      );
    }

    await client.query('COMMIT');
    console.log('Seed data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
