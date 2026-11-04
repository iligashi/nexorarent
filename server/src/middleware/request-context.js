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

    const endResponse = res.end;
    let responseEnding = false;
    res.end = function (...args) {
      if (responseEnding || res.statusCode >= 400) {
        return endResponse.apply(this, args);
      }
      responseEnding = true;

      const path = req.originalUrl.split('?')[0];
      const targetId = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] || null;
      const action = `${req.method.toLowerCase()} ${path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig, ':id')}`.slice(0, 120);
      const changedFields = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? Object.keys(req.body)
        : [];
      const changeSummary = req.auditChangeSummary || (changedFields.length
        ? { changed_fields: changedFields }
        : null);
      const audit = Promise.resolve().then(() => insert(
        `INSERT INTO admin_audit_log (request_id, user_id, method, path, status_code, action, target_id, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.requestId, req.user?.id || null, req.method, path, res.statusCode, action, targetId,
          changeSummary ? JSON.stringify(changeSummary) : null]
      ));

      audit.then(() => {
        endResponse.apply(res, args);
      }).catch(error => {
        logger.error('admin_audit_log_failed', {
          requestId: req.requestId,
          userId: req.user?.id,
          method: req.method,
          path,
          error: error.message,
        });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.removeHeader('Content-Length');
          res.removeHeader('ETag');
          endResponse.call(res, JSON.stringify({
            error: 'Admin action could not be durably recorded',
            requestId: req.requestId,
          }));
        } else {
          res.destroy(error);
        }
      });
      return this;
    };

    next();
  };
}

export const auditAdminAction = createAdminAuditAction();
