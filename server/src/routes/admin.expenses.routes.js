import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// List all expenses with optional filters and pagination
router.get('/', async (req, res, next) => {
  try {
    const { car_id, category, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (car_id) {
      conditions.push(`e.car_id = $${idx++}`);
      params.push(car_id);
    }
    if (category) {
      conditions.push(`e.category = $${idx++}`);
      params.push(category);
    }
    if (date_from) {
      conditions.push(`e.expense_date >= $${idx++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`e.expense_date <= $${idx++}`);
      params.push(date_to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(`
      SELECT e.*, c.brand, c.model
      FROM car_expenses e
      LEFT JOIN cars c ON c.id = e.car_id
      ${where}
      ORDER BY e.expense_date DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, parseInt(limit), offset]);

    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM car_expenses e ${where}`,
      params
    );

    res.json({
      expenses: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        pages: Math.ceil(parseInt(countRows[0].total) / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// Aggregate summary: by category, by month, per-car profitability
router.get('/summary', async (req, res, next) => {
  try {
    const [byCategory, byMonth, profitability] = await Promise.all([
      query(`
        SELECT category, COUNT(*) AS count, SUM(amount) AS total
        FROM car_expenses
        GROUP BY category
        ORDER BY total DESC
      `),
      query(`
        SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month,
          SUM(amount) AS total, COUNT(*) AS count
        FROM car_expenses
        WHERE expense_date >= NOW() - INTERVAL 12 MONTH
        GROUP BY month
        ORDER BY month
      `),
      query(`
        SELECT c.id AS car_id, c.brand, c.model,
          COALESCE(rev.revenue, 0) AS revenue,
          COALESCE(exp.expenses, 0) AS expenses,
          COALESCE(rev.revenue, 0) - COALESCE(exp.expenses, 0) AS profit
        FROM cars c
        LEFT JOIN (
          SELECT car_id, SUM(total_price) AS revenue
          FROM reservations
          WHERE status IN ('confirmed', 'completed', 'active')
          GROUP BY car_id
        ) rev ON rev.car_id = c.id
        LEFT JOIN (
          SELECT car_id, SUM(amount) AS expenses
          FROM car_expenses
          GROUP BY car_id
        ) exp ON exp.car_id = c.id
        ORDER BY profit DESC
      `),
    ]);

    res.json({
      by_category: byCategory.rows,
      by_month: byMonth.rows,
      profitability: profitability.rows,
    });
  } catch (err) { next(err); }
});

// List expenses for a specific car
router.get('/car/:carId', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const { rows } = await query(`
      SELECT e.*, c.brand, c.model
      FROM car_expenses e
      LEFT JOIN cars c ON c.id = e.car_id
      WHERE e.car_id = $1
      ORDER BY e.expense_date DESC
      LIMIT $2 OFFSET $3
    `, [req.params.carId, parseInt(limit), offset]);

    const { rows: countRows } = await query(
      'SELECT COUNT(*) AS total FROM car_expenses WHERE car_id = $1',
      [req.params.carId]
    );

    res.json({
      expenses: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        pages: Math.ceil(parseInt(countRows[0].total) / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// Create expense
router.post('/', async (req, res, next) => {
  try {
    const { car_id, category, description, amount, expense_date, vendor } = req.body;

    if (!car_id || !category || !amount || !expense_date) {
      return res.status(400).json({ error: 'car_id, category, amount, and expense_date are required' });
    }

    const id = uuidv4();
    await query(`
      INSERT INTO car_expenses (id, car_id, category, description, amount, expense_date, vendor, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, car_id, category, description || null, parseFloat(amount), expense_date, vendor || null, req.user.id]);

    const { rows } = await query('SELECT * FROM car_expenses WHERE id = $1', [id]);
    res.status(201).json({ expense: rows[0] });
  } catch (err) { next(err); }
});

// Update expense
router.put('/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await query('SELECT id FROM car_expenses WHERE id = $1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Expense not found' });

    const { car_id, category, description, amount, expense_date, vendor } = req.body;
    const fields = [];
    const params = [];
    let idx = 1;

    if (car_id !== undefined)      { fields.push(`car_id = $${idx++}`);      params.push(car_id); }
    if (category !== undefined)    { fields.push(`category = $${idx++}`);    params.push(category); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (amount !== undefined)      { fields.push(`amount = $${idx++}`);      params.push(parseFloat(amount)); }
    if (expense_date !== undefined) { fields.push(`expense_date = $${idx++}`); params.push(expense_date); }
    if (vendor !== undefined)      { fields.push(`vendor = $${idx++}`);      params.push(vendor); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await query(`UPDATE car_expenses SET ${fields.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query('SELECT * FROM car_expenses WHERE id = $1', [req.params.id]);
    res.json({ expense: rows[0] });
  } catch (err) { next(err); }
});

// Delete expense
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id FROM car_expenses WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Expense not found' });

    await query('DELETE FROM car_expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
});

export default router;
