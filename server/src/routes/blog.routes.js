import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

// Public: published posts
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const { rows } = await query(`
      SELECT bp.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name
      FROM blog_posts bp
      LEFT JOIN users u ON u.id = bp.author_id
      WHERE bp.is_published = true
      ORDER BY bp.published_at DESC
      LIMIT $1 OFFSET $2
    `, [Number(limit), offset]);
    const { rows: countRows } = await query("SELECT COUNT(*) AS count FROM blog_posts WHERE is_published = true");
    res.json({ posts: rows, total: parseInt(countRows[0].count) });
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT bp.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name
      FROM blog_posts bp
      LEFT JOIN users u ON u.id = bp.author_id
      WHERE bp.slug = $1 AND bp.is_published = true
    `, [req.params.slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) { next(err); }
});

export default router;
