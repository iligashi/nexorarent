import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// List all reviews with optional status filter, pagination
router.get('/', async (req, res, next) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status === 'pending') {
      conditions.push(`rv.is_approved = false`);
    } else if (status === 'approved') {
      conditions.push(`rv.is_approved = true`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(`
      SELECT rv.*,
        u.first_name, u.last_name,
        res.reservation_no,
        c.brand, c.model
      FROM reviews rv
      LEFT JOIN users u ON u.id = rv.user_id
      LEFT JOIN reservations res ON res.id = rv.reservation_id
      LEFT JOIN cars c ON c.id = res.car_id
      ${where}
      ORDER BY rv.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, parseInt(limit), offset]);

    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM reviews rv ${where}`,
      params
    );

    res.json({
      reviews: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        pages: Math.ceil(parseInt(countRows[0].total) / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// Approve a review
router.put('/:id/approve', async (req, res, next) => {
  try {
    await query('UPDATE reviews SET is_approved = true WHERE id = $1', [req.params.id]);
    const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json({ review: rows[0] });
  } catch (err) { next(err); }
});

// Reject a review
router.put('/:id/reject', async (req, res, next) => {
  try {
    await query('UPDATE reviews SET is_approved = false WHERE id = $1', [req.params.id]);
    const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json({ review: rows[0] });
  } catch (err) { next(err); }
});

// Reply to a review
router.put('/:id/reply', async (req, res, next) => {
  try {
    const { admin_reply } = req.body;
    if (!admin_reply || !admin_reply.trim()) {
      return res.status(400).json({ error: 'admin_reply is required' });
    }

    await query(
      'UPDATE reviews SET admin_reply = $1, replied_at = NOW() WHERE id = $2',
      [admin_reply.trim(), req.params.id]
    );
    const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json({ review: rows[0] });
  } catch (err) { next(err); }
});

// Delete a review
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id FROM reviews WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });

    await query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ message: 'Review deleted' });
  } catch (err) { next(err); }
});

export default router;
