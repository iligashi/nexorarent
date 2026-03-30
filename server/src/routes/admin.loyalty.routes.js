import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireManager } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Tier thresholds
const TIER_THRESHOLDS = { bronze: 0, silver: 200, gold: 500, platinum: 1000 };

function getTier(lifetimePoints) {
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return 'gold';
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

// List all loyalty accounts
router.get('/accounts', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT la.*, u.first_name, u.last_name, u.email
      FROM loyalty_accounts la
      JOIN users u ON u.id = la.user_id
      ORDER BY la.lifetime_points DESC
    `);
    res.json({ accounts: rows });
  } catch (err) { next(err); }
});

// Get single account
router.get('/accounts/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT la.*, u.first_name, u.last_name, u.email FROM loyalty_accounts la
      JOIN users u ON u.id = la.user_id WHERE la.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const { rows: txns } = await query(`
      SELECT lt.*, r.reservation_no FROM loyalty_transactions lt
      LEFT JOIN reservations r ON r.id = lt.reservation_id
      WHERE lt.account_id = $1 ORDER BY lt.created_at DESC LIMIT 50
    `, [req.params.id]);

    res.json({ account: rows[0], transactions: txns });
  } catch (err) { next(err); }
});

// Manually adjust points
router.put('/accounts/:id/adjust', requireManager, async (req, res, next) => {
  try {
    const { points, description } = req.body;
    if (!points) return res.status(400).json({ error: 'points required' });

    const { rows: acctRows } = await query('SELECT * FROM loyalty_accounts WHERE id = $1', [req.params.id]);
    if (acctRows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const acct = acctRows[0];
    const newBalance = acct.points_balance + parseInt(points);
    const newLifetime = parseInt(points) > 0 ? acct.lifetime_points + parseInt(points) : acct.lifetime_points;
    const newTier = getTier(newLifetime);

    await query('UPDATE loyalty_accounts SET points_balance = $1, lifetime_points = $2, tier = $3 WHERE id = $4',
      [Math.max(0, newBalance), newLifetime, newTier, req.params.id]);

    await query('INSERT INTO loyalty_transactions (id, account_id, type, points, description) VALUES ($1,$2,$3,$4,$5)',
      [uuidv4(), req.params.id, 'adjust', parseInt(points), description || 'Manual adjustment by admin']);

    const { rows } = await query('SELECT * FROM loyalty_accounts WHERE id = $1', [req.params.id]);
    res.json({ account: rows[0] });
  } catch (err) { next(err); }
});

// CRUD loyalty rewards
router.get('/rewards', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM loyalty_rewards ORDER BY points_cost');
    res.json({ rewards: rows });
  } catch (err) { next(err); }
});

router.post('/rewards', requireManager, async (req, res, next) => {
  try {
    const { name, description, type, value, points_cost, min_tier } = req.body;
    if (!name || !type || !value || !points_cost) return res.status(400).json({ error: 'name, type, value, points_cost required' });
    const id = uuidv4();
    await query(`INSERT INTO loyalty_rewards (id, name, description, type, value, points_cost, min_tier)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, name, description || null, type, value, points_cost, min_tier || 'bronze']);
    const { rows } = await query('SELECT * FROM loyalty_rewards WHERE id = $1', [id]);
    res.status(201).json({ reward: rows[0] });
  } catch (err) { next(err); }
});

router.put('/rewards/:id', requireManager, async (req, res, next) => {
  try {
    const { name, description, type, value, points_cost, is_active, min_tier } = req.body;
    const fields = []; const params = []; let idx = 1;
    if (name !== undefined)        { fields.push(`name = $${idx++}`);        params.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (type !== undefined)        { fields.push(`type = $${idx++}`);        params.push(type); }
    if (value !== undefined)       { fields.push(`value = $${idx++}`);       params.push(value); }
    if (points_cost !== undefined) { fields.push(`points_cost = $${idx++}`); params.push(points_cost); }
    if (is_active !== undefined)   { fields.push(`is_active = $${idx++}`);   params.push(is_active); }
    if (min_tier !== undefined)    { fields.push(`min_tier = $${idx++}`);    params.push(min_tier); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE loyalty_rewards SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    const { rows } = await query('SELECT * FROM loyalty_rewards WHERE id = $1', [req.params.id]);
    res.json({ reward: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/rewards/:id', requireManager, async (req, res, next) => {
  try {
    await query('DELETE FROM loyalty_rewards WHERE id = $1', [req.params.id]);
    res.json({ message: 'Reward deleted' });
  } catch (err) { next(err); }
});

// Config: tier thresholds and earn rate
router.get('/config', async (req, res, next) => {
  res.json({ config: { points_per_euro: 1, tier_thresholds: TIER_THRESHOLDS } });
});

// === Utility: earn points when reservation completes ===
export async function earnLoyaltyPoints(userId, reservationId, totalPrice) {
  if (!userId) return;
  const points = Math.floor(parseFloat(totalPrice)); // 1 point per euro

  // Get or create loyalty account
  let { rows } = await query('SELECT * FROM loyalty_accounts WHERE user_id = $1', [userId]);
  if (rows.length === 0) {
    const id = uuidv4();
    await query('INSERT INTO loyalty_accounts (id, user_id) VALUES ($1, $2)', [id, userId]);
    rows = [{ id, points_balance: 0, lifetime_points: 0 }];
  }
  const acct = rows[0];

  const newBalance = acct.points_balance + points;
  const newLifetime = acct.lifetime_points + points;
  const newTier = getTier(newLifetime);

  await query('UPDATE loyalty_accounts SET points_balance = $1, lifetime_points = $2, tier = $3 WHERE id = $4',
    [newBalance, newLifetime, newTier, acct.id]);

  await query('INSERT INTO loyalty_transactions (id, account_id, reservation_id, type, points, description) VALUES ($1,$2,$3,$4,$5,$6)',
    [uuidv4(), acct.id, reservationId, 'earn', points, `Earned from reservation`]);

  await query('UPDATE reservations SET loyalty_points_earned = $1 WHERE id = $2', [points, reservationId]);

  return { points_earned: points, new_balance: newBalance, tier: newTier };
}

export default router;
