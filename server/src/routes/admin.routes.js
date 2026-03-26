import { Router } from 'express';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { query, getConnection } from '../db/pool.js';
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
             AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`),
      query(`SELECT COUNT(*) AS count FROM reservations WHERE status IN ('confirmed', 'active')`),
      query(`SELECT COUNT(*) AS count FROM cars WHERE is_available = true`),
      query(`SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`),
      query(`SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month, SUM(total_price) AS revenue, COUNT(*) AS bookings
             FROM reservations WHERE status IN ('confirmed','completed','active')
             AND created_at >= NOW() - INTERVAL 12 MONTH
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
    const intervalMap = { '7d': '7 DAY', '30d': '30 DAY', '90d': '90 DAY', '12m': '12 MONTH' };
    const interval = intervalMap[period] || '12 MONTH';

    const [overview, byCategory, topCars] = await Promise.all([
      query(`SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month,
              SUM(total_price) AS revenue, COUNT(*) AS bookings,
              AVG(total_days) AS avg_days
             FROM reservations WHERE status IN ('confirmed','completed','active')
             AND created_at >= NOW() - INTERVAL ${interval}
             GROUP BY month ORDER BY month`),
      query(`SELECT c.category, SUM(r.total_price) AS revenue, COUNT(*) AS bookings
             FROM reservations r JOIN cars c ON c.id = r.car_id
             WHERE r.status IN ('confirmed','completed','active')
             AND r.created_at >= NOW() - INTERVAL ${interval}
             GROUP BY c.category ORDER BY revenue DESC`),
      query(`SELECT c.brand, c.model, SUM(r.total_price) AS revenue, COUNT(*) AS bookings
             FROM reservations r JOIN cars c ON c.id = r.car_id
             WHERE r.status IN ('confirmed','completed','active')
             AND r.created_at >= NOW() - INTERVAL ${interval}
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
      conditions.push(`(r.reservation_no LIKE $${idx} OR r.guest_name LIKE $${idx} OR CONCAT(u.first_name, ' ', u.last_name) LIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const { rows } = await query(`
      SELECT r.*, c.brand, c.model,
        COALESCE(r.guest_name, CONCAT(u.first_name, ' ', u.last_name)) AS customer_name,
        COALESCE(r.guest_phone, u.phone) AS customer_phone,
        COALESCE(r.guest_email, u.email) AS customer_email
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN users u ON u.id = r.user_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const countResult = await query(`SELECT COUNT(*) AS count FROM reservations r LEFT JOIN users u ON u.id = r.user_id ${where}`, params.slice(0, -2));

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

    await query(
      `UPDATE reservations SET status = $1, admin_notes = COALESCE($2, admin_notes) WHERE id = $3`,
      [status, admin_notes || null, req.params.id]
    );
    const { rows } = await query('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });
    res.json({ reservation: rows[0] });
  } catch (err) { next(err); }
});

// Calendar data
router.get('/reservations/calendar', async (req, res, next) => {
  try {
    const { rows: cars } = await query(`
      SELECT c.id AS car_id, CONCAT(c.brand, ' ', c.model) AS car_name
      FROM cars c
      ORDER BY c.brand, c.model
    `);

    const result = [];
    for (const car of cars) {
      const { rows: reservations } = await query(`
        SELECT r.id, r.pickup_date AS start, r.dropoff_date AS end,
          r.status,
          COALESCE(r.guest_name, CONCAT(u.first_name, ' ', u.last_name)) AS customer
        FROM reservations r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.car_id = $1 AND r.status NOT IN ('cancelled', 'rejected')
        ORDER BY r.pickup_date
      `, [car.car_id]);

      result.push({
        car_id: car.car_id,
        car_name: car.car_name,
        reservations,
      });
    }

    res.json({ calendar: result });
  } catch (err) { next(err); }
});

// CRUD Cars (Admin)
router.post('/cars', requireManager, async (req, res, next) => {
  try {
    const { brand, model, year, category, fuel, transmission, seats, doors, horsepower,
      engine_cc, color, license_plate, vin, mileage, price_per_day, price_per_week,
      deposit, description, features, is_featured } = req.body;

    const slug = `${brand}-${model}-${year}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = uuidv4();

    await query(`
      INSERT INTO cars (id, brand, model, year, slug, category, fuel, transmission, seats, doors,
        horsepower, engine_cc, color, license_plate, vin, mileage, price_per_day, price_per_week,
        deposit, description, features, is_featured)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    `, [id, brand, model, year, slug, category, fuel, transmission, seats || 5, doors || 4,
      horsepower, engine_cc, color, license_plate, vin, mileage || 0, price_per_day, price_per_week,
      deposit || 0, description, features ? JSON.stringify(features) : '[]', is_featured || false]);

    const { rows } = await query('SELECT * FROM cars WHERE id = $1', [id]);
    res.status(201).json({ car: rows[0] });
  } catch (err) { next(err); }
});

router.put('/cars/:id', requireManager, async (req, res, next) => {
  try {
    const { brand, model, year, category, fuel, transmission, seats, doors, horsepower,
      engine_cc, color, license_plate, mileage, price_per_day, price_per_week,
      deposit, description, features, is_featured } = req.body;

    await query(`
      UPDATE cars SET brand=COALESCE($1,brand), model=COALESCE($2,model), year=COALESCE($3,year),
        category=COALESCE($4,category), fuel=COALESCE($5,fuel), transmission=COALESCE($6,transmission),
        seats=COALESCE($7,seats), doors=COALESCE($8,doors), horsepower=COALESCE($9,horsepower),
        engine_cc=COALESCE($10,engine_cc), color=COALESCE($11,color), license_plate=COALESCE($12,license_plate),
        mileage=COALESCE($13,mileage), price_per_day=COALESCE($14,price_per_day),
        price_per_week=COALESCE($15,price_per_week), deposit=COALESCE($16,deposit),
        description=COALESCE($17,description), features=COALESCE($18,features), is_featured=COALESCE($19,is_featured)
      WHERE id = $20
    `, [brand, model, year, category, fuel, transmission, seats, doors, horsepower,
      engine_cc, color, license_plate, mileage, price_per_day, price_per_week,
      deposit, description, features ? JSON.stringify(features) : null, is_featured, req.params.id]);

    const { rows } = await query('SELECT * FROM cars WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    res.json({ car: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/cars/:id', requireManager, async (req, res, next) => {
  try {
    await query('UPDATE cars SET is_available = false WHERE id = $1', [req.params.id]);
    const { rows } = await query('SELECT id FROM cars WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    res.json({ message: 'Car deactivated' });
  } catch (err) { next(err); }
});

router.patch('/cars/:id/toggle', async (req, res, next) => {
  try {
    await query(
      'UPDATE cars SET is_available = NOT is_available WHERE id = $1',
      [req.params.id]
    );
    const { rows } = await query('SELECT id, is_available FROM cars WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    res.json({ car: rows[0] });
  } catch (err) { next(err); }
});

// Add car image by URL
router.post('/cars/:id/images/url', async (req, res, next) => {
  try {
    const carId = req.params.id;
    const { url, alt_text, is_primary } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // If setting as primary, unset other primaries first
    if (is_primary) {
      await query('UPDATE car_images SET is_primary = false WHERE car_id = $1', [carId]);
    }

    const imgId = uuidv4();
    const { rows: countRows } = await query('SELECT COUNT(*) AS count FROM car_images WHERE car_id = $1', [carId]);
    const sortOrder = parseInt(countRows[0].count);
    const setPrimary = is_primary || sortOrder === 0;

    await query(
      'INSERT INTO car_images (id, car_id, url, alt_text, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
      [imgId, carId, url, alt_text || null, setPrimary, sortOrder]
    );
    const { rows } = await query('SELECT * FROM car_images WHERE id = $1', [imgId]);
    res.status(201).json({ image: rows[0] });
  } catch (err) { next(err); }
});

// Car image upload (file)
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
      const imgId = uuidv4();

      await query(
        'INSERT INTO car_images (id, car_id, url, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [imgId, carId, url, isPrimary, uploaded.length]
      );
      const { rows } = await query('SELECT * FROM car_images WHERE id = $1', [imgId]);
      uploaded.push(rows[0]);
    }

    res.status(201).json({ images: uploaded });
  } catch (err) { next(err); }
});

router.delete('/cars/:carId/images/:imgId', async (req, res, next) => {
  try {
    const { rows: existing } = await query('SELECT id FROM car_images WHERE id = $1 AND car_id = $2', [req.params.imgId, req.params.carId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Image not found' });
    await query('DELETE FROM car_images WHERE id = $1 AND car_id = $2', [req.params.imgId, req.params.carId]);
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
      conditions.push(`(CONCAT(u.first_name, ' ', u.last_name) LIKE $${idx} OR u.email LIKE $${idx})`);
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

// Blog CRUD
router.get('/blog', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT bp.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name
      FROM blog_posts bp LEFT JOIN users u ON u.id = bp.author_id
      ORDER BY bp.created_at DESC
    `);
    res.json({ posts: rows });
  } catch (err) { next(err); }
});

router.post('/blog', requireManager, async (req, res, next) => {
  try {
    const { title, content, excerpt, is_published } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = uuidv4();
    await query(`
      INSERT INTO blog_posts (id, title, slug, content, excerpt, author_id, is_published, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, title, slug, content, excerpt || null, req.user.id, is_published || false, is_published ? new Date() : null]);
    const { rows } = await query('SELECT * FROM blog_posts WHERE id = $1', [id]);
    res.status(201).json({ post: rows[0] });
  } catch (err) { next(err); }
});

router.put('/blog/:id', requireManager, async (req, res, next) => {
  try {
    const { title, content, excerpt, is_published } = req.body;
    await query(`
      UPDATE blog_posts SET title=COALESCE($1,title), content=COALESCE($2,content),
        excerpt=COALESCE($3,excerpt), is_published=COALESCE($4,is_published),
        published_at = CASE WHEN $4 = true AND published_at IS NULL THEN NOW() ELSE published_at END
      WHERE id = $5
    `, [title, content, excerpt, is_published, req.params.id]);
    const { rows } = await query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/blog/:id', requireManager, async (req, res, next) => {
  try {
    const { rows: existing } = await query('SELECT id FROM blog_posts WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Post not found' });
    await query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Post deleted' });
  } catch (err) { next(err); }
});

// Settings
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT `key`, value FROM settings');
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
        'INSERT INTO settings (`key`, value) VALUES ($1, $2) ON DUPLICATE KEY UPDATE value = $2',
        [key, JSON.stringify(value)]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { next(err); }
});

// Helper to run query on a connection with $N -> ? conversion
async function connQuery(conn, sql, params = []) {
  let mysqlSql = sql;
  const maxParam = params.length;
  for (let i = maxParam; i >= 1; i--) {
    mysqlSql = mysqlSql.replaceAll(`$${i}`, '?');
  }
  mysqlSql = mysqlSql.replace(/::\w+/g, '');
  const [rows] = await conn.execute(mysqlSql, params);
  return { rows };
}

function generateReservationNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DRC-${date}-${rand}`;
}

// Admin create reservation for a customer
router.post('/reservations', async (req, res, next) => {
  const conn = await getConnection();
  try {
    const { car_id, pickup_location, dropoff_location, pickup_date, dropoff_date,
      customer_name, customer_email, customer_phone, notes, admin_notes, extras, status } = req.body;

    if (!car_id || !pickup_location || !dropoff_location || !pickup_date || !dropoff_date || !customer_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pickupDt = new Date(pickup_date);
    const dropoffDt = new Date(dropoff_date);
    if (dropoffDt <= pickupDt) {
      return res.status(400).json({ error: 'Dropoff date must be after pickup date' });
    }

    // Get car price
    const { rows: carRows } = await connQuery(conn, 'SELECT price_per_day FROM cars WHERE id = $1', [car_id]);
    if (carRows.length === 0) return res.status(404).json({ error: 'Car not found' });

    const totalDays = Math.max(1, Math.ceil((dropoffDt - pickupDt) / (1000 * 60 * 60 * 24)));
    const dailyRate = parseFloat(carRows[0].price_per_day);

    // Seasonal pricing
    const { rows: seasonal } = await connQuery(conn, `
      SELECT multiplier FROM seasonal_pricing
      WHERE car_id = $1 AND start_date <= $2 AND end_date >= $3 LIMIT 1
    `, [car_id, pickup_date, dropoff_date]);
    const multiplier = seasonal.length > 0 ? parseFloat(seasonal[0].multiplier) : 1.0;

    const basePrice = dailyRate * multiplier * totalDays;

    // Calculate extras
    let extrasTotal = 0;
    const extrasToInsert = [];
    if (extras && extras.length > 0) {
      for (const ext of extras) {
        const { rows: extRows } = await connQuery(conn, 'SELECT price_per_day FROM extras WHERE id = $1', [ext.extra_id]);
        if (extRows.length > 0) {
          const extPrice = parseFloat(extRows[0].price_per_day) * totalDays * (ext.quantity || 1);
          extrasTotal += extPrice;
          extrasToInsert.push({ extra_id: ext.extra_id, quantity: ext.quantity || 1, price: extPrice });
        }
      }
    }

    const totalPrice = basePrice + extrasTotal;
    const reservationNo = generateReservationNo();
    const reservationId = uuidv4();
    const resStatus = status || 'confirmed';

    await conn.beginTransaction();

    await connQuery(conn, `
      INSERT INTO reservations (id, reservation_no, user_id, car_id, pickup_location, dropoff_location,
        pickup_date, dropoff_date, status, total_days, daily_rate, extras_total, total_price,
        guest_name, guest_email, guest_phone, notes, admin_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      reservationId, reservationNo, null, car_id, pickup_location, dropoff_location,
      pickup_date, dropoff_date, resStatus, totalDays, dailyRate * multiplier, extrasTotal, totalPrice,
      customer_name, customer_email || null, customer_phone || null, notes || null, admin_notes || null,
    ]);

    for (const ext of extrasToInsert) {
      await connQuery(conn,
        'INSERT INTO reservation_extras (id, reservation_id, extra_id, quantity, price) VALUES ($1,$2,$3,$4,$5)',
        [uuidv4(), reservationId, ext.extra_id, ext.quantity, ext.price]
      );
    }

    await conn.commit();

    // Return full reservation with car info
    const { rows: resRows } = await query(`
      SELECT r.*, c.brand, c.model,
        pl.name AS pickup_location_name, dl.name AS dropoff_location_name
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN locations pl ON pl.id = r.pickup_location
      LEFT JOIN locations dl ON dl.id = r.dropoff_location
      WHERE r.id = $1
    `, [reservationId]);

    res.status(201).json({ reservation: resRows[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Generate PDF invoice for a reservation
router.get('/reservations/:id/invoice', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*, c.brand, c.model, c.year, c.color, c.license_plate, c.category,
        pl.name AS pickup_location_name, pl.address AS pickup_address,
        dl.name AS dropoff_location_name, dl.address AS dropoff_address,
        COALESCE(r.guest_name, CONCAT(u.first_name, ' ', u.last_name)) AS customer_name,
        COALESCE(r.guest_email, u.email) AS customer_email,
        COALESCE(r.guest_phone, u.phone) AS customer_phone
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN locations pl ON pl.id = r.pickup_location
      LEFT JOIN locations dl ON dl.id = r.dropoff_location
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = $1
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });
    const r = rows[0];

    // Get extras
    const { rows: extras } = await query(`
      SELECT re.*, e.name FROM reservation_extras re
      JOIN extras e ON e.id = re.extra_id
      WHERE re.reservation_id = $1
    `, [r.id]);

    // Get company settings
    const { rows: settingsRows } = await query('SELECT `key`, value FROM settings');
    const settings = {};
    for (const s of settingsRows) {
      try { settings[s.key] = JSON.parse(s.value); } catch { settings[s.key] = s.value; }
    }

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=invoice-${r.reservation_no}.pdf`);
    doc.pipe(res);

    const accentColor = '#FF4D30';
    const darkColor = '#1a1a2e';
    const grayColor = '#666666';
    const lightGray = '#f5f5f5';

    // Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor(accentColor)
      .text(settings.company_name || 'Drenas Rent a Car', 50, 50);
    doc.fontSize(9).font('Helvetica').fillColor(grayColor)
      .text(settings.company_address || 'Drenas, Kosovo', 50, 80)
      .text(`Phone: ${settings.company_phone || ''} | Email: ${settings.company_email || ''}`, 50, 93);

    // Invoice title
    doc.fontSize(28).font('Helvetica-Bold').fillColor(darkColor)
      .text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor(grayColor)
      .text(`#${r.reservation_no}`, 400, 85, { align: 'right' })
      .text(`Date: ${new Date(r.created_at).toLocaleDateString('en-GB')}`, 400, 100, { align: 'right' });

    // Divider
    doc.moveTo(50, 120).lineTo(545, 120).strokeColor(accentColor).lineWidth(2).stroke();

    // Customer info
    let y = 140;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(darkColor).text('Bill To:', 50, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').fillColor('#333333')
      .text(r.customer_name || 'N/A', 50, y);
    y += 15;
    if (r.customer_email) { doc.text(r.customer_email, 50, y); y += 15; }
    if (r.customer_phone) { doc.text(r.customer_phone, 50, y); y += 15; }

    // Reservation details box
    const boxY = 140;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(darkColor).text('Reservation Details:', 300, boxY);
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    const detailX = 300;
    const valX = 430;
    doc.text('Status:', detailX, boxY + 18).font('Helvetica-Bold').fillColor(accentColor).text(r.status.toUpperCase(), valX, boxY + 18);
    doc.font('Helvetica').fillColor('#333333');
    doc.text('Pickup:', detailX, boxY + 36).text(new Date(r.pickup_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), valX, boxY + 36);
    doc.text('Return:', detailX, boxY + 54).text(new Date(r.dropoff_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), valX, boxY + 54);
    doc.text('Duration:', detailX, boxY + 72).text(`${r.total_days} day${r.total_days > 1 ? 's' : ''}`, valX, boxY + 72);

    // Vehicle section
    y = Math.max(y, boxY + 105) + 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    y += 15;

    doc.fontSize(11).font('Helvetica-Bold').fillColor(darkColor).text('Vehicle', 50, y);
    y += 20;

    // Table header
    doc.rect(50, y, 495, 24).fill('#1a1a2e');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('VEHICLE', 60, y + 7).text('CATEGORY', 220, y + 7).text('COLOR', 320, y + 7).text('PLATE', 420, y + 7);
    y += 24;

    // Table row
    doc.rect(50, y, 495, 28).fill(lightGray);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(darkColor).text(`${r.brand} ${r.model} (${r.year})`, 60, y + 8);
    doc.font('Helvetica').text(r.category, 220, y + 8).text(r.color || '-', 320, y + 8).text(r.license_plate || '-', 420, y + 8);
    y += 28;

    // Locations
    y += 15;
    doc.fontSize(9).font('Helvetica').fillColor(grayColor);
    doc.text(`Pickup: ${r.pickup_location_name || ''}${r.pickup_address ? ' - ' + r.pickup_address : ''}`, 60, y);
    y += 14;
    doc.text(`Return: ${r.dropoff_location_name || ''}${r.dropoff_address ? ' - ' + r.dropoff_address : ''}`, 60, y);
    y += 25;

    // Pricing table
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    y += 15;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(darkColor).text('Pricing Breakdown', 50, y);
    y += 20;

    // Pricing header
    doc.rect(50, y, 495, 24).fill('#1a1a2e');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('DESCRIPTION', 60, y + 7).text('QTY', 320, y + 7).text('RATE', 390, y + 7).text('AMOUNT', 470, y + 7);
    y += 24;

    // Rental row
    const baseAmount = parseFloat(r.daily_rate) * r.total_days;
    doc.rect(50, y, 495, 26).fill(lightGray);
    doc.fontSize(9).font('Helvetica').fillColor(darkColor);
    doc.text(`Car Rental - ${r.brand} ${r.model}`, 60, y + 8);
    doc.text(`${r.total_days} day${r.total_days > 1 ? 's' : ''}`, 320, y + 8);
    doc.text(`€${parseFloat(r.daily_rate).toFixed(2)}`, 390, y + 8);
    doc.font('Helvetica-Bold').text(`€${baseAmount.toFixed(2)}`, 470, y + 8);
    y += 26;

    // Extras rows
    for (const ext of extras) {
      const bgColor = y % 2 === 0 ? '#ffffff' : lightGray;
      doc.rect(50, y, 495, 26).fill(bgColor);
      doc.font('Helvetica').fillColor(darkColor);
      doc.text(ext.name, 60, y + 8);
      doc.text(`${ext.quantity}`, 320, y + 8);
      doc.text(`€${(parseFloat(ext.price) / ext.quantity / r.total_days).toFixed(2)}/day`, 390, y + 8);
      doc.font('Helvetica-Bold').text(`€${parseFloat(ext.price).toFixed(2)}`, 470, y + 8);
      y += 26;
    }

    // Totals
    y += 10;
    doc.moveTo(350, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    y += 10;

    doc.fontSize(10).font('Helvetica').fillColor(grayColor);
    doc.text('Subtotal:', 350, y).text(`€${baseAmount.toFixed(2)}`, 470, y);
    y += 18;

    if (parseFloat(r.extras_total) > 0) {
      doc.text('Extras:', 350, y).text(`€${parseFloat(r.extras_total).toFixed(2)}`, 470, y);
      y += 18;
    }

    if (parseFloat(r.discount) > 0) {
      doc.fillColor('#22c55e').text('Discount:', 350, y).text(`-€${parseFloat(r.discount).toFixed(2)}`, 470, y);
      y += 18;
    }

    doc.moveTo(350, y).lineTo(545, y).strokeColor(accentColor).lineWidth(1.5).stroke();
    y += 10;
    doc.fontSize(14).font('Helvetica-Bold').fillColor(accentColor);
    doc.text('TOTAL:', 350, y).text(`€${parseFloat(r.total_price).toFixed(2)}`, 460, y);

    // Footer
    const footerY = 760;
    doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor(grayColor);
    doc.text('Thank you for choosing ' + (settings.company_name || 'Drenas Rent a Car') + '!', 50, footerY + 10, { align: 'center' });
    doc.text(`${settings.company_address || 'Drenas, Kosovo'} | ${settings.company_phone || ''} | ${settings.company_email || ''}`, 50, footerY + 22, { align: 'center' });

    doc.end();
  } catch (err) { next(err); }
});

export default router;
