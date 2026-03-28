import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// List all deliveries with optional status filter
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const conditions = []; const params = []; let idx = 1;
    if (status) { conditions.push(`da.status = $${idx++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(`
      SELECT da.*,
        CONCAT(d.first_name, ' ', d.last_name) AS driver_name, d.phone AS driver_phone,
        r.reservation_no,
        COALESCE(r.guest_name, CONCAT(u.first_name, ' ', u.last_name)) AS customer_name,
        COALESCE(r.guest_phone, u.phone) AS customer_phone,
        CONCAT(c.brand, ' ', c.model) AS car_name
      FROM delivery_assignments da
      JOIN users d ON d.id = da.driver_id
      JOIN reservations r ON r.id = da.reservation_id
      LEFT JOIN users u ON u.id = r.user_id
      JOIN cars c ON c.id = r.car_id
      ${where}
      ORDER BY da.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, Number(limit), offset]);

    const countResult = await query(`SELECT COUNT(*) AS count FROM delivery_assignments da ${where}`, params);
    res.json({ deliveries: rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { next(err); }
});

// Get drivers (staff/driver role users)
router.get('/drivers', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, first_name, last_name, phone FROM users WHERE role IN ('staff','driver','manager','owner') ORDER BY first_name`);
    res.json({ drivers: rows });
  } catch (err) { next(err); }
});

// Create delivery assignment
router.post('/', async (req, res, next) => {
  try {
    const { reservation_id, driver_id, type, destination_lat, destination_lng, destination_address, notes } = req.body;
    if (!reservation_id || !driver_id || !type) return res.status(400).json({ error: 'reservation_id, driver_id, type required' });

    const id = uuidv4();
    await query(`
      INSERT INTO delivery_assignments (id, reservation_id, driver_id, type, destination_lat, destination_lng, destination_address, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [id, reservation_id, driver_id, type, destination_lat || null, destination_lng || null, destination_address || null, notes || null]);

    const { rows } = await query(`
      SELECT da.*, CONCAT(d.first_name, ' ', d.last_name) AS driver_name
      FROM delivery_assignments da JOIN users d ON d.id = da.driver_id WHERE da.id = $1
    `, [id]);
    res.status(201).json({ delivery: rows[0] });
  } catch (err) { next(err); }
});

// Update delivery status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['assigned', 'en_route', 'arrived', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const extra = [];
    if (status === 'en_route') extra.push('started_at = NOW()');
    if (status === 'completed') extra.push('completed_at = NOW()');

    const setClause = [`status = $1`, ...extra].join(', ');
    await query(`UPDATE delivery_assignments SET ${setClause} WHERE id = $2`, [status, req.params.id]);

    const { rows } = await query(`
      SELECT da.*, CONCAT(d.first_name, ' ', d.last_name) AS driver_name, d.phone AS driver_phone
      FROM delivery_assignments da JOIN users d ON d.id = da.driver_id WHERE da.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    res.json({ delivery: rows[0] });
  } catch (err) { next(err); }
});

// Post driver location (can be called by driver)
router.post('/:id/location', async (req, res, next) => {
  try {
    const { lat, lng, speed, heading } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const { rows: delRows } = await query('SELECT driver_id FROM delivery_assignments WHERE id = $1', [req.params.id]);
    if (delRows.length === 0) return res.status(404).json({ error: 'Delivery not found' });

    const id = uuidv4();
    await query(`
      INSERT INTO driver_locations (id, driver_id, assignment_id, lat, lng, speed, heading)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [id, delRows[0].driver_id, req.params.id, lat, lng, speed || null, heading || null]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Get location history for a delivery
router.get('/:id/locations', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT lat, lng, speed, heading, recorded_at FROM driver_locations
      WHERE assignment_id = $1 ORDER BY recorded_at DESC LIMIT 100
    `, [req.params.id]);
    res.json({ locations: rows });
  } catch (err) { next(err); }
});

// Get latest location
router.get('/:id/location/latest', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT lat, lng, speed, heading, recorded_at FROM driver_locations
      WHERE assignment_id = $1 ORDER BY recorded_at DESC LIMIT 1
    `, [req.params.id]);
    res.json({ location: rows[0] || null });
  } catch (err) { next(err); }
});

export default router;
