import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query, getConnection } from '../db/pool.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const reservationSchema = z.object({
  car_id: z.string().uuid(),
  pickup_location: z.string().uuid(),
  dropoff_location: z.string().uuid(),
  pickup_date: z.string(),
  dropoff_date: z.string(),
  guest_name: z.string().optional(),
  guest_email: z.string().email().optional(),
  guest_phone: z.string().optional(),
  notes: z.string().optional(),
  extras: z.array(z.object({
    extra_id: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  })).optional(),
});

function generateReservationNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DRC-${date}-${rand}`;
}

// Helper to run a query on a connection with $N -> ? conversion
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

// Create reservation
router.post('/', optionalAuth, validate(reservationSchema), async (req, res, next) => {
  const conn = await getConnection();
  try {
    const data = req.validated;
    const pickupDate = new Date(data.pickup_date);
    const dropoffDate = new Date(data.dropoff_date);

    if (dropoffDate <= pickupDate) {
      return res.status(400).json({ error: 'Dropoff date must be after pickup date' });
    }

    // Check availability
    const { rows: avail } = await connQuery(conn, `
      SELECT EXISTS (
        SELECT 1 FROM reservations
        WHERE car_id = $1 AND status IN ('confirmed', 'active')
          AND pickup_date < $3 AND dropoff_date > $2
      ) AS is_booked
    `, [data.car_id, data.pickup_date, data.dropoff_date]);

    if (avail[0].is_booked) {
      return res.status(409).json({ error: 'Car is not available for selected dates' });
    }

    // Get car price
    const { rows: carRows } = await connQuery(conn, 'SELECT price_per_day FROM cars WHERE id = $1', [data.car_id]);
    if (carRows.length === 0) return res.status(404).json({ error: 'Car not found' });

    const totalDays = Math.max(1, Math.ceil((dropoffDate - pickupDate) / (1000 * 60 * 60 * 24)));
    const dailyRate = parseFloat(carRows[0].price_per_day);

    // Check seasonal pricing
    const { rows: seasonal } = await connQuery(conn, `
      SELECT multiplier FROM seasonal_pricing
      WHERE car_id = $1 AND start_date <= $2 AND end_date >= $3
      LIMIT 1
    `, [data.car_id, data.pickup_date, data.dropoff_date]);
    const multiplier = seasonal.length > 0 ? parseFloat(seasonal[0].multiplier) : 1.0;

    const basePrice = dailyRate * multiplier * totalDays;

    // Calculate extras
    let extrasTotal = 0;
    const extrasToInsert = [];
    if (data.extras && data.extras.length > 0) {
      for (const ext of data.extras) {
        const { rows: extRows } = await connQuery(conn, 'SELECT price_per_day FROM extras WHERE id = $1 AND is_active = true', [ext.extra_id]);
        if (extRows.length > 0) {
          const extPrice = parseFloat(extRows[0].price_per_day) * totalDays * ext.quantity;
          extrasTotal += extPrice;
          extrasToInsert.push({ extra_id: ext.extra_id, quantity: ext.quantity, price: extPrice });
        }
      }
    }

    const totalPrice = basePrice + extrasTotal;
    const reservationNo = generateReservationNo();
    const reservationId = uuidv4();

    await conn.beginTransaction();

    await connQuery(conn, `
      INSERT INTO reservations (id, reservation_no, user_id, car_id, pickup_location, dropoff_location,
        pickup_date, dropoff_date, total_days, daily_rate, extras_total, total_price,
        guest_name, guest_email, guest_phone, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      reservationId, reservationNo, req.user?.id || null, data.car_id, data.pickup_location, data.dropoff_location,
      data.pickup_date, data.dropoff_date, totalDays, dailyRate * multiplier, extrasTotal, totalPrice,
      data.guest_name || null, data.guest_email || null, data.guest_phone || null, data.notes || null,
    ]);

    for (const ext of extrasToInsert) {
      const extId = uuidv4();
      await connQuery(conn,
        'INSERT INTO reservation_extras (id, reservation_id, extra_id, quantity, price) VALUES ($1,$2,$3,$4,$5)',
        [extId, reservationId, ext.extra_id, ext.quantity, ext.price]
      );
    }

    await conn.commit();

    const { rows: resRows } = await connQuery(conn, 'SELECT * FROM reservations WHERE id = $1', [reservationId]);
    res.status(201).json({ reservation: resRows[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Get user's reservations
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*, c.brand, c.model, c.slug,
        (SELECT url FROM car_images WHERE car_id = c.id AND is_primary = 1 LIMIT 1) AS car_image,
        pl.name AS pickup_location_name, dl.name AS dropoff_location_name
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN locations pl ON pl.id = r.pickup_location
      LEFT JOIN locations dl ON dl.id = r.dropoff_location
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `, [req.user.id]);
    res.json({ reservations: rows });
  } catch (err) { next(err); }
});

// Get single reservation
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*, c.brand, c.model, c.slug,
        pl.name AS pickup_location_name, dl.name AS dropoff_location_name
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN locations pl ON pl.id = r.pickup_location
      LEFT JOIN locations dl ON dl.id = r.dropoff_location
      WHERE r.id = $1 AND (r.user_id = $2 OR $3 IN ('staff','manager','owner'))
    `, [req.params.id, req.user.id, req.user.role]);

    if (rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });

    const { rows: extras } = await query(`
      SELECT re.*, e.name, e.icon FROM reservation_extras re
      JOIN extras e ON e.id = re.extra_id
      WHERE re.reservation_id = $1
    `, [rows[0].id]);

    res.json({ reservation: { ...rows[0], extras } });
  } catch (err) { next(err); }
});

// Cancel reservation
router.put('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    await query(`
      UPDATE reservations SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'confirmed')
    `, [req.params.id, req.user.id]);

    const { rows } = await query('SELECT * FROM reservations WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);

    if (rows.length === 0 || rows[0].status !== 'cancelled') {
      return res.status(404).json({ error: 'Reservation not found or cannot be cancelled' });
    }
    res.json({ reservation: rows[0] });
  } catch (err) { next(err); }
});

export default router;
