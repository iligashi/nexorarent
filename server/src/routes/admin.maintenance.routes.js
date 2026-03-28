import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireManager } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// ── Maintenance Types ────────────────────────────────────────────────

// List all maintenance types
router.get('/types', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM maintenance_types ORDER BY name');
    res.json({ types: rows });
  } catch (err) { next(err); }
});

// Create maintenance type (manager only)
router.post('/types', requireManager, async (req, res, next) => {
  try {
    const { name, description, interval_days, interval_km } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = uuidv4();
    await query(`
      INSERT INTO maintenance_types (id, name, description, interval_days, interval_km)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, name, description || null, interval_days || null, interval_km || null]);

    const { rows } = await query('SELECT * FROM maintenance_types WHERE id = $1', [id]);
    res.status(201).json({ type: rows[0] });
  } catch (err) { next(err); }
});

// Update maintenance type
router.put('/types/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await query('SELECT id FROM maintenance_types WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Maintenance type not found' });

    const { name, description, interval_days, interval_km } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;

    if (name !== undefined)             { fields.push(`name = $${idx++}`);             params.push(name); }
    if (description !== undefined)      { fields.push(`description = $${idx++}`);      params.push(description); }
    if (interval_days !== undefined)    { fields.push(`interval_days = $${idx++}`);    params.push(interval_days); }
    if (interval_km !== undefined) { fields.push(`interval_km = $${idx++}`); params.push(interval_km); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await query(`UPDATE maintenance_types SET ${fields.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query('SELECT * FROM maintenance_types WHERE id = $1', [req.params.id]);
    res.json({ type: rows[0] });
  } catch (err) { next(err); }
});

// ── Maintenance Records ──────────────────────────────────────────────

// List all maintenance records with optional filters and pagination
router.get('/records', async (req, res, next) => {
  try {
    const { car_id, status, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (car_id) {
      conditions.push(`mr.car_id = $${idx++}`);
      params.push(car_id);
    }
    if (status) {
      conditions.push(`mr.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(`
      SELECT mr.*, mt.name AS type_name, c.brand AS car_brand, c.model AS car_model
      FROM maintenance_records mr
      LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
      LEFT JOIN cars c ON c.id = mr.car_id
      ${where}
      ORDER BY mr.scheduled_date DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, parseInt(limit), offset]);

    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM maintenance_records mr ${where}`,
      params
    );

    res.json({
      records: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        pages: Math.ceil(parseInt(countRows[0].total) / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// Upcoming and overdue maintenance alerts
router.get('/alerts', async (req, res, next) => {
  try {
    const [upcoming, overdue] = await Promise.all([
      query(`
        SELECT mr.*, mt.name AS type_name, c.brand AS car_brand, c.model AS car_model
        FROM maintenance_records mr
        LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
        LEFT JOIN cars c ON c.id = mr.car_id
        WHERE mr.next_due_date IS NOT NULL
          AND mr.next_due_date <= NOW() + INTERVAL 30 DAY
          AND mr.next_due_date > NOW()
          AND mr.status != 'completed'
        ORDER BY mr.next_due_date ASC
      `),
      query(`
        SELECT mr.*, mt.name AS type_name, c.brand AS car_brand, c.model AS car_model
        FROM maintenance_records mr
        LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
        LEFT JOIN cars c ON c.id = mr.car_id
        WHERE mr.status = 'overdue'
          OR (mr.next_due_date IS NOT NULL AND mr.next_due_date <= NOW() AND mr.status != 'completed')
        ORDER BY mr.next_due_date ASC
      `),
    ]);

    res.json({
      upcoming: upcoming.rows,
      overdue: overdue.rows,
    });
  } catch (err) { next(err); }
});

// Records for a specific car
router.get('/car/:carId', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const { rows } = await query(`
      SELECT mr.*, mt.name AS type_name, c.brand AS car_brand, c.model AS car_model
      FROM maintenance_records mr
      LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
      LEFT JOIN cars c ON c.id = mr.car_id
      WHERE mr.car_id = $1
      ORDER BY mr.scheduled_date DESC
      LIMIT $2 OFFSET $3
    `, [req.params.carId, parseInt(limit), offset]);

    const { rows: countRows } = await query(
      'SELECT COUNT(*) AS total FROM maintenance_records WHERE car_id = $1',
      [req.params.carId]
    );

    res.json({
      records: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        pages: Math.ceil(parseInt(countRows[0].total) / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// Create maintenance record
router.post('/records', async (req, res, next) => {
  try {
    const { car_id, maintenance_type_id, scheduled_date, notes, vendor } = req.body;

    if (!car_id || !maintenance_type_id || !scheduled_date) {
      return res.status(400).json({ error: 'car_id, maintenance_type_id, and scheduled_date are required' });
    }

    const id = uuidv4();
    await query(`
      INSERT INTO maintenance_records (id, car_id, maintenance_type_id, scheduled_date, notes, vendor, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, car_id, maintenance_type_id, scheduled_date, notes || null, vendor || null, req.user.id]);

    const { rows } = await query(`
      SELECT mr.*, mt.name AS type_name
      FROM maintenance_records mr
      LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
      WHERE mr.id = $1
    `, [id]);
    res.status(201).json({ record: rows[0] });
  } catch (err) { next(err); }
});

// Update maintenance record
router.put('/records/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await query(
      'SELECT mr.*, mt.interval_days FROM maintenance_records mr LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id WHERE mr.id = $1',
      [req.params.id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Record not found' });

    const { car_id, maintenance_type_id, scheduled_date, status, notes, vendor, cost, mileage_at_service } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;

    if (car_id !== undefined)              { fields.push(`car_id = $${idx++}`);              params.push(car_id); }
    if (maintenance_type_id !== undefined)  { fields.push(`maintenance_type_id = $${idx++}`);  params.push(maintenance_type_id); }
    if (scheduled_date !== undefined)       { fields.push(`scheduled_date = $${idx++}`);       params.push(scheduled_date); }
    if (notes !== undefined)               { fields.push(`notes = $${idx++}`);               params.push(notes); }
    if (vendor !== undefined)              { fields.push(`vendor = $${idx++}`);              params.push(vendor); }
    if (cost !== undefined)                { fields.push(`cost = $${idx++}`);                params.push(parseFloat(cost)); }
    if (mileage_at_service !== undefined)  { fields.push(`mileage_at_service = $${idx++}`);  params.push(parseInt(mileage_at_service)); }

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(status);

      // When completing, set completed_date and calculate next_due_date
      if (status === 'completed') {
        fields.push('completed_date = NOW()');
        if (existing[0].interval_days) {
          fields.push(`next_due_date = DATE_ADD(NOW(), INTERVAL $${idx++} DAY)`);
          params.push(parseInt(existing[0].interval_days));
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await query(`UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query(`
      SELECT mr.*, mt.name AS type_name
      FROM maintenance_records mr
      LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
      WHERE mr.id = $1
    `, [req.params.id]);
    res.json({ record: rows[0] });
  } catch (err) { next(err); }
});

// Complete a maintenance record (shortcut)
router.put('/records/:id/complete', async (req, res, next) => {
  try {
    const { rows: existing } = await query(`
      SELECT mr.*, mt.interval_days
      FROM maintenance_records mr
      LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
      WHERE mr.id = $1
    `, [req.params.id]);

    if (existing.length === 0) return res.status(404).json({ error: 'Record not found' });
    const record = existing[0];

    if (record.status === 'completed') {
      return res.status(400).json({ error: 'Record is already completed' });
    }

    const { cost, mileage_at_service } = req.body;

    // Build update for maintenance record
    const updateFields = [
      "status = 'completed'",
      'completed_date = NOW()',
    ];
    const updateParams = [];
    let idx = 1;

    if (cost !== undefined) {
      updateFields.push(`cost = $${idx++}`);
      updateParams.push(parseFloat(cost));
    }
    if (mileage_at_service !== undefined) {
      updateFields.push(`mileage_at_service = $${idx++}`);
      updateParams.push(parseInt(mileage_at_service));
    }
    if (record.interval_days) {
      updateFields.push(`next_due_date = DATE_ADD(NOW(), INTERVAL $${idx++} DAY)`);
      updateParams.push(parseInt(record.interval_days));
    }

    updateParams.push(req.params.id);
    await query(
      `UPDATE maintenance_records SET ${updateFields.join(', ')} WHERE id = $${idx}`,
      updateParams
    );

    // Auto-create a car_expense record if cost is provided
    if (cost !== undefined && parseFloat(cost) > 0) {
      const expenseId = uuidv4();
      await query(`
        INSERT INTO car_expenses (id, car_id, category, description, amount, expense_date, vendor, created_by)
        VALUES ($1, $2, 'repair', $3, $4, CURDATE(), $5, $6)
      `, [
        expenseId,
        record.car_id,
        `Maintenance: ${record.maintenance_type_id}`,
        parseFloat(cost),
        record.vendor || null,
        req.user.id,
      ]);
    }

    const { rows } = await query(`
      SELECT mr.*, mt.name AS type_name
      FROM maintenance_records mr
      LEFT JOIN maintenance_types mt ON mt.id = mr.maintenance_type_id
      WHERE mr.id = $1
    `, [req.params.id]);
    res.json({ record: rows[0] });
  } catch (err) { next(err); }
});

export default router;
