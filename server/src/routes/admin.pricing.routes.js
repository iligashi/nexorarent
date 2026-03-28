import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireManager } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// List pricing rules
router.get('/rules', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT pr.*, c.brand, c.model
      FROM pricing_rules pr
      LEFT JOIN cars c ON c.id = pr.car_id
      ORDER BY pr.priority DESC, pr.created_at DESC
    `);
    res.json({ rules: rows });
  } catch (err) { next(err); }
});

// Create pricing rule
router.post('/rules', requireManager, async (req, res, next) => {
  try {
    const { name, type, car_id, category, multiplier, conditions, priority, is_active, start_date, end_date } = req.body;
    if (!name || !type || !multiplier || !conditions) {
      return res.status(400).json({ error: 'name, type, multiplier, and conditions are required' });
    }
    const id = uuidv4();
    await query(`
      INSERT INTO pricing_rules (id, name, type, car_id, category, multiplier, conditions, priority, is_active, start_date, end_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [id, name, type, car_id || null, category || null, multiplier, JSON.stringify(conditions), priority || 0, is_active !== false, start_date || null, end_date || null]);
    const { rows } = await query('SELECT * FROM pricing_rules WHERE id = $1', [id]);
    res.status(201).json({ rule: rows[0] });
  } catch (err) { next(err); }
});

// Update pricing rule
router.put('/rules/:id', requireManager, async (req, res, next) => {
  try {
    const { name, type, car_id, category, multiplier, conditions, priority, is_active, start_date, end_date } = req.body;
    const fields = []; const params = []; let idx = 1;
    if (name !== undefined)       { fields.push(`name = $${idx++}`);       params.push(name); }
    if (type !== undefined)       { fields.push(`type = $${idx++}`);       params.push(type); }
    if (car_id !== undefined)     { fields.push(`car_id = $${idx++}`);     params.push(car_id || null); }
    if (category !== undefined)   { fields.push(`category = $${idx++}`);   params.push(category || null); }
    if (multiplier !== undefined) { fields.push(`multiplier = $${idx++}`); params.push(multiplier); }
    if (conditions !== undefined) { fields.push(`conditions = $${idx++}`); params.push(JSON.stringify(conditions)); }
    if (priority !== undefined)   { fields.push(`priority = $${idx++}`);   params.push(priority); }
    if (is_active !== undefined)  { fields.push(`is_active = $${idx++}`);  params.push(is_active); }
    if (start_date !== undefined) { fields.push(`start_date = $${idx++}`); params.push(start_date || null); }
    if (end_date !== undefined)   { fields.push(`end_date = $${idx++}`);   params.push(end_date || null); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    await query(`UPDATE pricing_rules SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    const { rows } = await query('SELECT * FROM pricing_rules WHERE id = $1', [req.params.id]);
    res.json({ rule: rows[0] });
  } catch (err) { next(err); }
});

// Delete pricing rule
router.delete('/rules/:id', requireManager, async (req, res, next) => {
  try {
    await query('DELETE FROM pricing_rules WHERE id = $1', [req.params.id]);
    res.json({ message: 'Rule deleted' });
  } catch (err) { next(err); }
});

// Get demand level for a date range
router.get('/demand', async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const [totalCars, bookedCars] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM cars WHERE is_available = true'),
      query(`SELECT COUNT(DISTINCT car_id) AS count FROM reservations
             WHERE status IN ('confirmed','active') AND pickup_date <= $1 AND dropoff_date >= $2`, [targetDate, targetDate]),
    ]);
    const total = parseInt(totalCars.rows[0].count) || 1;
    const booked = parseInt(bookedCars.rows[0].count);
    res.json({ date: targetDate, total_cars: total, booked_cars: booked, demand_percent: Math.round((booked / total) * 100) });
  } catch (err) { next(err); }
});

// Calculate dynamic price for a car + date range (utility endpoint)
router.get('/calculate', async (req, res, next) => {
  try {
    const { car_id, pickup_date, dropoff_date } = req.query;
    if (!car_id || !pickup_date || !dropoff_date) return res.status(400).json({ error: 'car_id, pickup_date, dropoff_date required' });

    const result = await calculateDynamicPrice(car_id, pickup_date, dropoff_date);
    res.json(result);
  } catch (err) { next(err); }
});

export async function calculateDynamicPrice(car_id, pickup_date, dropoff_date) {
  const { rows: carRows } = await query('SELECT price_per_day, category FROM cars WHERE id = $1', [car_id]);
  if (carRows.length === 0) throw new Error('Car not found');

  const dailyRate = parseFloat(carRows[0].price_per_day);
  const category = carRows[0].category;
  const totalDays = Math.max(1, Math.ceil((new Date(dropoff_date) - new Date(pickup_date)) / (1000 * 60 * 60 * 24)));

  // Seasonal pricing
  const { rows: seasonal } = await query(`
    SELECT multiplier FROM seasonal_pricing WHERE car_id = $1 AND start_date <= $2 AND end_date >= $3 LIMIT 1
  `, [car_id, pickup_date, dropoff_date]);
  const seasonalMultiplier = seasonal.length > 0 ? parseFloat(seasonal[0].multiplier) : 1.0;

  // Get active pricing rules
  const { rows: rules } = await query(`
    SELECT * FROM pricing_rules
    WHERE is_active = true
      AND (car_id IS NULL OR car_id = $1)
      AND (category IS NULL OR category = $2)
      AND (start_date IS NULL OR start_date <= $3)
      AND (end_date IS NULL OR end_date >= $4)
    ORDER BY priority DESC
  `, [car_id, category, pickup_date, dropoff_date]);

  // Calculate demand
  const [totalCars, bookedCars] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM cars WHERE is_available = true'),
    query(`SELECT COUNT(DISTINCT car_id) AS count FROM reservations
           WHERE status IN ('confirmed','active') AND pickup_date <= $1 AND dropoff_date >= $2`, [pickup_date, pickup_date]),
  ]);
  const demandPercent = Math.round((parseInt(bookedCars.rows[0].count) / Math.max(1, parseInt(totalCars.rows[0].count))) * 100);
  const daysBeforePickup = Math.ceil((new Date(pickup_date) - new Date()) / (1000 * 60 * 60 * 24));

  let dynamicMultiplier = 1.0;
  const appliedRules = [];

  for (const rule of rules) {
    const cond = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
    let applies = false;

    if (rule.type === 'demand' && cond.min_demand_percent && demandPercent >= cond.min_demand_percent) applies = true;
    if (rule.type === 'last_minute' && cond.days_before_pickup_max && daysBeforePickup <= cond.days_before_pickup_max) applies = true;
    if (rule.type === 'advance_booking' && cond.days_before_pickup_min && daysBeforePickup >= cond.days_before_pickup_min) applies = true;
    if (rule.type === 'duration' && cond.min_days && totalDays >= cond.min_days) applies = true;

    if (applies) {
      dynamicMultiplier = parseFloat(rule.multiplier);
      appliedRules.push({ name: rule.name, type: rule.type, multiplier: parseFloat(rule.multiplier) });
      break; // highest priority wins
    }
  }

  const finalRate = dailyRate * seasonalMultiplier * dynamicMultiplier;
  const totalPrice = finalRate * totalDays;

  return {
    daily_rate: dailyRate,
    seasonal_multiplier: seasonalMultiplier,
    dynamic_multiplier: dynamicMultiplier,
    final_daily_rate: Math.round(finalRate * 100) / 100,
    total_days: totalDays,
    total_price: Math.round(totalPrice * 100) / 100,
    demand_percent: demandPercent,
    applied_rules: appliedRules,
  };
}

export default router;
