import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1),
});

router.post('/', validate(contactSchema), async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.validated;
    const { rows } = await query(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, email, phone || null, subject || null, message]
    );
    res.status(201).json({ message: 'Message sent successfully', id: rows[0].id });
  } catch (err) { next(err); }
});

export default router;
