import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const reviewSchema = z.object({
  reservation_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

router.post('/', authenticate, validate(reviewSchema), async (req, res, next) => {
  try {
    const { reservation_id, rating, comment } = req.validated;

    // Verify completed reservation belongs to user
    const { rows: resRows } = await query(
      "SELECT id FROM reservations WHERE id = $1 AND user_id = $2 AND status = 'completed'",
      [reservation_id, req.user.id]
    );
    if (resRows.length === 0) {
      return res.status(400).json({ error: 'Can only review completed reservations' });
    }

    const { rows } = await query(
      'INSERT INTO reviews (user_id, reservation_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, reservation_id, rating, comment || null]
    );
    res.status(201).json({ review: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already reviewed' });
    next(err);
  }
});

export default router;
