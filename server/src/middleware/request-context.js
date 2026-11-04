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

export function createAdminAuditAction(insert = query) {
  return function auditAdminAction(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode >= 400) return;

      const path = req.originalUrl.split('?')[0];
      const targetId = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] || null;
      const action = `${req.method.toLowerCase()} ${path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig, ':id')}`.slice(0, 120);
      insert(
        `INSERT INTO admin_audit_log (request_id, user_id, method, path, status_code, action, target_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.requestId, req.user?.id || null, req.method, path, res.statusCode, action, targetId]
      ).catch(error => {
        logger.error('admin_audit_log_failed', {
          requestId: req.requestId,
          userId: req.user?.id,
          method: req.method,
          path,
          error: error.message,
        });
      });
    });

    next();
  };
}

export const auditAdminAction = createAdminAuditAction();
