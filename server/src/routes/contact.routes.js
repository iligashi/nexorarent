import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
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
    const id = uuidv4();
    await query(
      'INSERT INTO contact_messages (id, name, email, phone, subject, message) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name, email, phone || null, subject || null, message]
    );
    const { rows } = await query('SELECT * FROM contact_messages WHERE id = $1', [id]);
    res.status(201).json({ message: 'Message sent successfully', id: rows[0].id });
  } catch (err) { next(err); }
});

export default router;
