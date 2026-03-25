import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM extras WHERE is_active = true ORDER BY name');
    res.json({ extras: rows });
  } catch (err) { next(err); }
});

export default router;
