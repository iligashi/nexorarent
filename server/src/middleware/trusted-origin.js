import { config } from '../config.js';

export function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin');
  const allowedOrigins = config.CLIENT_URL.split(',').map(value => value.trim());
  let allowed = origin && allowedOrigins.includes(origin);
  if (!allowed && origin && config.NODE_ENV === 'development') {
    try {
      const url = new URL(origin);
      allowed = url.protocol === 'http:'
        && ['localhost', '127.0.0.1'].includes(url.hostname);
    } catch {
      allowed = false;
    }
  }
  if (!allowed) {
    return res.status(403).json({ error: 'Request origin is not allowed' });
  }
  next();
}
