import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { refreshCookieOptions } from '../config.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(6).max(72),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
}).refine(data => Object.keys(data).length > 0, 'At least one field is required');

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// Register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone } = req.validated;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email, passwordHash, first_name, last_name, phone || null]
    );

    const { rows } = await query(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = $1',
      [id]
    );

    const user = rows[0];
    const tokens = generateTokens(user.id);

    res.cookie('refreshToken', tokens.refreshToken, refreshCookieOptions);

    res.status(201).json({ user, accessToken: tokens.accessToken });
  } catch (err) { next(err); }
});

// Login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;

    const { rows } = await query(
      'SELECT id, email, password_hash, first_name, last_name, phone, role FROM users WHERE email = $1',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = generateTokens(user.id);
    delete user.password_hash;

    res.cookie('refreshToken', tokens.refreshToken, refreshCookieOptions);

    res.json({ user, accessToken: tokens.accessToken });
  } catch (err) { next(err); }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { rows } = await query(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const tokens = generateTokens(rows[0].id);

    res.cookie('refreshToken', tokens.refreshToken, refreshCookieOptions);

    res.json({ user: rows[0], accessToken: tokens.accessToken });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', refreshCookieOptions);
  res.status(204).end();
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Get current user's loyalty points
router.get('/me/loyalty', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT points_balance, tier FROM loyalty_accounts WHERE user_id = $1',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.json({ points_balance: 0, tier: 'bronze' });
    }
    res.json({ points_balance: rows[0].points_balance, tier: rows[0].tier });
  } catch (err) { next(err); }
});

// Update profile
router.put('/me', authenticate, validate(profileSchema), async (req, res, next) => {
  try {
    const { first_name, last_name, phone } = req.validated;
    await query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), phone = COALESCE($3, phone)
       WHERE id = $4`,
      [first_name, last_name, phone, req.user.id]
    );
    const { rows } = await query(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

export default router;
