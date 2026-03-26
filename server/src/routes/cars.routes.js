import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

// List cars with filters + pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      category, fuel, transmission, price_min, price_max,
      search, sort = 'newest', page = 1, limit = 12,
    } = req.query;

    const conditions = ['c.is_available = true'];
    const params = [];
    let paramIdx = 1;

    if (category) { conditions.push(`c.category = $${paramIdx++}`); params.push(category); }
    if (fuel) { conditions.push(`c.fuel = $${paramIdx++}`); params.push(fuel); }
    if (transmission) { conditions.push(`c.transmission = $${paramIdx++}`); params.push(transmission); }
    if (price_min) { conditions.push(`c.price_per_day >= $${paramIdx++}`); params.push(Number(price_min)); }
    if (price_max) { conditions.push(`c.price_per_day <= $${paramIdx++}`); params.push(Number(price_max)); }
    if (search) {
      conditions.push(`CONCAT(c.brand, ' ', c.model) LIKE $${paramIdx++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'c.sort_order ASC, c.created_at DESC';
    if (sort === 'price_asc') orderBy = 'c.price_per_day ASC';
    else if (sort === 'price_desc') orderBy = 'c.price_per_day DESC';
    else if (sort === 'newest') orderBy = 'c.created_at DESC';

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const carsQuery = `
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND is_primary = true LIMIT 1) AS image,
        COALESCE(AVG(rv.rating), 0) AS avg_rating,
        COUNT(rv.id) AS review_count
      FROM cars c
      LEFT JOIN reservations res ON res.car_id = c.id
      LEFT JOIN reviews rv ON rv.reservation_id = res.id AND rv.is_approved = true
      ${where}
      GROUP BY c.id
      ORDER BY ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const countQuery = `SELECT COUNT(*) AS count FROM cars c ${where}`;

    const [carsResult, countResult] = await Promise.all([
      query(carsQuery, params),
      query(countQuery, params.slice(0, -2)),
    ]);

    res.json({
      cars: carsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) { next(err); }
});

// Featured cars
router.get('/featured', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND is_primary = true LIMIT 1) AS image
      FROM cars c
      WHERE c.is_available = true AND c.is_featured = true
      ORDER BY c.sort_order ASC
      LIMIT 6
    `);
    res.json({ cars: rows });
  } catch (err) { next(err); }
});

// Single car by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows: carRows } = await query(
      `SELECT c.*,
        COALESCE(AVG(rv.rating), 0) AS avg_rating,
        COUNT(rv.id) AS review_count
       FROM cars c
       LEFT JOIN reservations res ON res.car_id = c.id
       LEFT JOIN reviews rv ON rv.reservation_id = res.id AND rv.is_approved = true
       WHERE c.slug = $1
       GROUP BY c.id`,
      [req.params.slug]
    );
    if (carRows.length === 0) return res.status(404).json({ error: 'Car not found' });

    const car = carRows[0];

    const { rows: images } = await query(
      'SELECT id, url, alt_text, is_primary, sort_order FROM car_images WHERE car_id = $1 ORDER BY sort_order',
      [car.id]
    );

    const { rows: reviews } = await query(
      `SELECT rv.*, u.first_name, u.last_name
       FROM reviews rv JOIN users u ON u.id = rv.user_id
       WHERE rv.reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)
         AND rv.is_approved = true
       ORDER BY rv.created_at DESC LIMIT 10`,
      [car.id]
    );

    res.json({ car: { ...car, images, reviews } });
  } catch (err) { next(err); }
});

// Check availability
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { pickup_date, dropoff_date } = req.query;
    if (!pickup_date || !dropoff_date) {
      return res.status(400).json({ error: 'pickup_date and dropoff_date required' });
    }

    const { rows } = await query(`
      SELECT NOT EXISTS (
        SELECT 1 FROM reservations
        WHERE car_id = $1
          AND status IN ('confirmed', 'active')
          AND pickup_date < $3
          AND dropoff_date > $2
      ) AS is_available
    `, [req.params.id, pickup_date, dropoff_date]);

    // Also get blocked dates for calendar
    const { rows: blocked } = await query(`
      SELECT pickup_date, dropoff_date FROM reservations
      WHERE car_id = $1 AND status IN ('confirmed', 'active', 'pending')
      ORDER BY pickup_date
    `, [req.params.id]);

    res.json({ is_available: !!rows[0].is_available, blocked_dates: blocked });
  } catch (err) { next(err); }
});

export default router;
