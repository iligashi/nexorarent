import { randomUUID } from 'crypto';
import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';

export function requestContext(req, res, next) {
  req.requestId = randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Date.now() - req.requestStartedAt,
      userId: req.user?.id,
    });
  });
  next();
}

export function auditAdminAction(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    query(
      `INSERT INTO admin_audit_log (request_id, user_id, method, path, status_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.requestId, req.user?.id || null, req.method, req.originalUrl.split('?')[0], res.statusCode]
    ).catch(error => {
      logger.error('admin_audit_log_failed', {
        requestId: req.requestId,
        userId: req.user?.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        error: error.message,
      });
    });
  });

  next();
}
