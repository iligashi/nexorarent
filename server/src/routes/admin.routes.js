import { Router } from 'express';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireManager } from '../middleware/admin.js';
import { upload } from '../middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
router.use(authenticate, requireAdmin);

// Dashboard overview
router.get('/dashboard', async (req, res, next) => {
  try {
    const [revenue, activeRes, availCars, newCustomers, revenueChart, statusDist] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_price), 0) AS total FROM reservations
             WHERE status IN ('confirmed','completed','active')
             AND created_at >= DATE_TRUNC('month', NOW())`),
      query(`SELECT COUNT(*) FROM reservations WHERE status IN ('confirmed', 'active')`),
      query(`SELECT COUNT(*) FROM cars WHERE is_available = true`),
      query(`SELECT COUNT(*) FROM users WHERE role = 'customer' AND created_at >= DATE_TRUNC('month', NOW())`),
      query(`SELECT DATE_TRUNC('month', created_at) AS month, SUM(total_price) AS revenue, COUNT(*) AS bookings
             FROM reservations WHERE status IN ('confirmed','completed','active')
             AND created_at >= NOW() - INTERVAL '12 months'
             GROUP BY month ORDER BY month`),
      query(`SELECT status, COUNT(*) AS count FROM reservations GROUP BY status`),
    ]);

    res.json({
      revenue_this_month: parseFloat(revenue.rows[0].total),
      active_reservations: parseInt(activeRes.rows[0].count),
      available_cars: parseInt(availCars.rows[0].count),
      new_customers: parseInt(newCustomers.rows[0].count),
      revenue_chart: revenueChart.rows,
      status_distribution: statusDist.rows,
    });
  } catch (err) { next(err); }
});

// Revenue analytics
router.get('/revenue', async (req, res, next) => {
  try {
    const { period = '12m' } = req.query;
    const intervalMap = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '12m': '12 months' };
    const interval = intervalMap[period] || '12 months';

    const [overview, byCategory, topCars] = await Promise.all([
      query(`SELECT DATE_TRUNC('month', created_at) AS month,
              SUM(total_price) AS revenue, COUNT(*) AS bookings,
              AVG(total_days) AS avg_days
             FROM reservations WHERE status IN ('confirmed','completed','active')
             AND created_at >= NOW() - INTERVAL '${interval}'
             GROUP BY month ORDER BY month`),
      query(`SELECT c.category, SUM(r.total_price) AS revenue, COUNT(*) AS bookings
             FROM reservations r JOIN cars c ON c.id = r.car_id
             WHERE r.status IN ('confirmed','completed','active')
             AND r.created_at >= NOW() - INTERVAL '${interval}'
             GROUP BY c.category ORDER BY revenue DESC`),
      query(`SELECT c.brand, c.model, SUM(r.total_price) AS revenue, COUNT(*) AS bookings
             FROM reservations r JOIN cars c ON c.id = r.car_id
             WHERE r.status IN ('confirmed','completed','active')
             AND r.created_at >= NOW() - INTERVAL '${interval}'
             GROUP BY c.id, c.brand, c.model ORDER BY revenue DESC LIMIT 10`),
    ]);

    res.json({ overview: overview.rows, by_category: byCategory.rows, top_cars: topCars.rows });
  } catch (err) { next(err); }
});

// All reservations (admin)
router.get('/reservations', async (req, res, next) => {
  try {
    const { status, car_id, search, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status && status !== 'all') { conditions.push(`r.status = $${idx++}`); params.push(status); }
    if (car_id) { conditions.push(`r.car_id = $${idx++}`); params.push(car_id); }
    if (search) {
      conditions.push(`(r.reservation_no ILIKE $${idx} OR r.guest_name ILIKE $${idx} OR u.first_name || ' ' || u.last_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const { rows } = await query(`
      SELECT r.*, c.brand, c.model,
        COALESCE(r.guest_name, u.first_name || ' ' || u.last_name) AS customer_name,
        COALESCE(r.guest_phone, u.phone) AS customer_phone,
        COALESCE(r.guest_email, u.email) AS customer_email
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN users u ON u.id = r.user_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const countResult = await query(`SELECT COUNT(*) FROM reservations r LEFT JOIN users u ON u.id = r.user_id ${where}`, params.slice(0, -2));

    res.json({ reservations: rows, total: parseInt(countResult.rows[0].count), page: Number(page) });
  } catch (err) { next(err); }
});

// Update reservation status
router.put('/reservations/:id/status', async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    const validStatuses = ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { rows } = await query(
      `UPDATE reservations SET status = $1, admin_notes = COALESCE($2, admin_notes) WHERE id = $3 RETURNING *`,
      [status, admin_notes || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });
    res.json({ reservation: rows[0] });
  } catch (err) { next(err); }
});

// Calendar data
router.get('/reservations/calendar', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT c.id AS car_id, c.brand || ' ' || c.model AS car_name,
        json_agg(json_build_object(
          'id', r.id, 'start', r.pickup_date, 'end', r.dropoff_date,
          'status', r.status,
          'customer', COALESCE(r.guest_name, u.first_name || ' ' || u.last_name)
        ) ORDER BY r.pickup_date) AS reservations
      FROM cars c
      LEFT JOIN reservations r ON r.car_id = c.id AND r.status NOT IN ('cancelled', 'rejected')
      LEFT JOIN users u ON u.id = r.user_id
      GROUP BY c.id, c.brand, c.model
      ORDER BY c.brand, c.model
    `);
    res.json({ calendar: rows });
  } catch (err) { next(err); }
});

// CRUD Cars (Admin)
router.post('/cars', requireManager, async (req, res, next) => {
  try {
    const { brand, model, year, category, fuel, transmission, seats, doors, horsepower,
      engine_cc, color, license_plate, vin, mileage, price_per_day, price_per_week,
      deposit, description, features, is_featured } = req.body;

    const slug = `${brand}-${model}-${year}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { rows } = await query(`
      INSERT INTO cars (brand, model, year, slug, category, fuel, transmission, seats, doors,
        horsepower, engine_cc, color, license_plate, vin, mileage, price_per_day, price_per_week,
        deposit, description, features, is_featured)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [brand, model, year, slug, category, fuel, transmission, seats || 5, doors || 4,
      horsepower, engine_cc, color, license_plate, vin, mileage || 0, price_per_day, price_per_week,
      deposit || 0, description, features || [], is_featured || false]);

    res.status(201).json({ car: rows[0] });
  } catch (err) { next(err); }
});

router.put('/cars/:id', requireManager, async (req, res, next) => {
  try {
    const { brand, model, year, category, fuel, transmission, seats, doors, horsepower,
      engine_cc, color, license_plate, mileage, price_per_day, price_per_week,
      deposit, description, features, is_featured } = req.body;

    const { rows } = await query(`
      UPDATE cars SET brand=COALESCE($1,brand), model=COALESCE($2,model), year=COALESCE($3,year),
        category=COALESCE($4,category), fuel=COALESCE($5,fuel), transmission=COALESCE($6,transmission),
        seats=COALESCE($7,seats), doors=COALESCE($8,doors), horsepower=COALESCE($9,horsepower),
        engine_cc=COALESCE($10,engine_cc), color=COALESCE($11,color), license_plate=COALESCE($12,license_plate),
        mileage=COALESCE($13,mileage), price_per_day=COALESCE($14,price_per_day),
        price_per_week=COALESCE($15,price_per_week), deposit=COALESCE($16,deposit),
        description=COALESCE($17,description), features=COALESCE($18,features), is_featured=COALESCE($19,is_featured)
      WHERE id = $20 RETURNING *
    `, [brand, model, year, category, fuel, transmission, seats, doors, horsepower,
      engine_cc, color, license_plate, mileage, price_per_day, price_per_week,
      deposit, description, features, is_featured, req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    res.json({ car: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/cars/:id', requireManager, async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE cars SET is_available = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    res.json({ message: 'Car deactivated' });
  } catch (err) { next(err); }
});

router.patch('/cars/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE cars SET is_available = NOT is_available WHERE id = $1 RETURNING id, is_available',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    res.json({ car: rows[0] });
  } catch (err) { next(err); }
});

// Car image upload
router.post('/cars/:id/images', upload.array('images', 10), async (req, res, next) => {
  try {
    const carId = req.params.id;
    const uploaded = [];

    for (const file of req.files) {
      const webpFilename = file.filename.replace(/\.[^.]+$/, '.webp');
      const outputPath = path.join(path.dirname(file.path), webpFilename);

      await sharp(file.path).resize(800, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(outputPath);

      const url = `/uploads/${webpFilename}`;
      const isPrimary = uploaded.length === 0;

      const { rows } = await query(
        'INSERT INTO car_images (car_id, url, is_primary, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [carId, url, isPrimary, uploaded.length]
      );
      uploaded.push(rows[0]);
    }

    res.status(201).json({ images: uploaded });
  } catch (err) { next(err); }
});

router.delete('/cars/:carId/images/:imgId', async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM car_images WHERE id = $1 AND car_id = $2 RETURNING id', [req.params.imgId, req.params.carId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Image not found' });
    res.json({ message: 'Image deleted' });
  } catch (err) { next(err); }
});

// Customers
router.get('/customers', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const conditions = ["u.role = 'customer'"];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(u.first_name || ' ' || u.last_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const { rows } = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at,
        COUNT(r.id) AS total_bookings,
        COALESCE(SUM(r.total_price), 0) AS total_spent,
        MAX(r.created_at) AS last_booking
      FROM users u
      LEFT JOIN reservations r ON r.user_id = u.id
      ${where}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    res.json({ customers: rows });
  } catch (err) { next(err); }
});

router.get('/customers/:id', async (req, res, next) => {
  try {
    const { rows: userRows } = await query(
      'SELECT id, first_name, last_name, email, phone, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const { rows: reservations } = await query(`
      SELECT r.*, c.brand, c.model FROM reservations r
      JOIN cars c ON c.id = r.car_id
      WHERE r.user_id = $1 ORDER BY r.created_at DESC
    `, [req.params.id]);

    res.json({ customer: { ...userRows[0], reservations } });
  } catch (err) { next(err); }
});

// Messages
router.get('/messages', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json({ messages: rows });
  } catch (err) { next(err); }
});

router.put('/messages/:id/read', async (req, res, next) => {
  try {
    await query('UPDATE contact_messages SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

// Settings
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (err) { next(err); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await query(
        'INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = $2::jsonb',
        [key, JSON.stringify(value)]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { next(err); }
});

export default router;
