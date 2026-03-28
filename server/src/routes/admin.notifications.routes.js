import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticate, requireAdmin);

// List notification templates
router.get('/templates', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM notification_templates ORDER BY type');
    res.json({ templates: rows });
  } catch (err) { next(err); }
});

// Update template
router.put('/templates/:id', async (req, res, next) => {
  try {
    const { template_body, is_active } = req.body;
    const fields = []; const params = []; let idx = 1;
    if (template_body !== undefined) { fields.push(`template_body = $${idx++}`); params.push(template_body); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(is_active); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE notification_templates SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    const { rows } = await query('SELECT * FROM notification_templates WHERE id = $1', [req.params.id]);
    res.json({ template: rows[0] });
  } catch (err) { next(err); }
});

// Notification log
router.get('/log', async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const conditions = [];
    const params = [];
    let idx = 1;
    if (status) { conditions.push(`nl.status = $${idx++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(`
      SELECT nl.*,
        COALESCE(r.reservation_no, '') AS reservation_no,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), '') AS customer_name
      FROM notification_log nl
      LEFT JOIN reservations r ON r.id = nl.reservation_id
      LEFT JOIN users u ON u.id = nl.user_id
      ${where}
      ORDER BY nl.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, Number(limit), offset]);

    const countResult = await query(`SELECT COUNT(*) AS count FROM notification_log nl ${where}`, params);
    res.json({ notifications: rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { next(err); }
});

// Manually send WhatsApp notification
router.post('/send', async (req, res, next) => {
  try {
    const { reservation_id, type, recipient } = req.body;
    if (!type || !recipient) return res.status(400).json({ error: 'type and recipient required' });

    const result = await sendNotification(type, recipient, reservation_id);
    res.json(result);
  } catch (err) { next(err); }
});

// Dashboard stats
router.get('/stats', async (req, res, next) => {
  try {
    const [total, sent, failed, pending] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM notification_log'),
      query("SELECT COUNT(*) AS count FROM notification_log WHERE status = 'sent'"),
      query("SELECT COUNT(*) AS count FROM notification_log WHERE status = 'failed'"),
      query("SELECT COUNT(*) AS count FROM notification_log WHERE status = 'pending'"),
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      sent: parseInt(sent.rows[0].count),
      failed: parseInt(failed.rows[0].count),
      pending: parseInt(pending.rows[0].count),
    });
  } catch (err) { next(err); }
});

// === Notification Sending Utility ===
function renderTemplate(template, data) {
  let text = template;
  for (const [key, value] of Object.entries(data)) {
    text = text.replaceAll(`{{${key}}}`, value || '');
  }
  return text;
}

export async function sendNotification(type, recipient, reservationId = null, userId = null, extraData = {}) {
  // Get template
  const { rows: templates } = await query(
    "SELECT * FROM notification_templates WHERE type = $1 AND channel = 'whatsapp' AND is_active = true LIMIT 1",
    [type]
  );
  if (templates.length === 0) return { success: false, error: 'No active template found' };

  // Get reservation data if available
  let data = { ...extraData };
  if (reservationId) {
    const { rows } = await query(`
      SELECT r.*, c.brand, c.model,
        COALESCE(r.guest_name, CONCAT(u.first_name, ' ', u.last_name)) AS customer_name,
        pl.name AS pickup_location, dl.name AS dropoff_location
      FROM reservations r
      JOIN cars c ON c.id = r.car_id
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN locations pl ON pl.id = r.pickup_location
      LEFT JOIN locations dl ON dl.id = r.dropoff_location
      WHERE r.id = $1
    `, [reservationId]);
    if (rows.length > 0) {
      const r = rows[0];
      data = {
        ...data,
        customer_name: r.customer_name || r.guest_name || '',
        reservation_no: r.reservation_no,
        car_name: `${r.brand} ${r.model}`,
        pickup_date: new Date(r.pickup_date).toLocaleDateString(),
        dropoff_date: new Date(r.dropoff_date).toLocaleDateString(),
        pickup_location: r.pickup_location || '',
        dropoff_location: r.dropoff_location || '',
        total_price: `€${parseFloat(r.total_price).toFixed(2)}`,
        status: r.status,
      };
    }
  }

  const message = renderTemplate(templates[0].template_body, data);
  const cleanPhone = recipient.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

  // Build WhatsApp URL (for manual sending via wa.me link)
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  // Log the notification
  const logId = uuidv4();
  await query(`
    INSERT INTO notification_log (id, reservation_id, user_id, type, channel, recipient, status, sent_at)
    VALUES ($1, $2, $3, $4, 'whatsapp', $5, 'sent', NOW())
  `, [logId, reservationId || null, userId || null, type, recipient]);

  logger.info(`WhatsApp notification [${type}] to ${recipient}`);

  return { success: true, message, whatsapp_url: waUrl, log_id: logId };
}

export default router;
