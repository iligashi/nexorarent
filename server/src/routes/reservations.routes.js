import { Router } from 'express';
import { query, getConnection } from '../db/pool.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReservation, guestReservationSchema, reservationSchema } from '../services/reservations.js';

const router = Router();

// Create reservation
router.post('/', optionalAuth, (req, res, next) => {
  validate(req.user ? reservationSchema : guestReservationSchema)(req, res, next);
}, async (req, res, next) => {
  let conn;
  try {
    conn = await getConnection();
    const reservation = await createReservation(conn, {
      data: req.validated,
      userId: req.user?.id || null,
    });
    res.status(201).json({ reservation });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
});

// Get user's reservations
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*, c.brand, c.model, c.slug,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS car_image,
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
