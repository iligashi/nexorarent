import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { createAdminAuditAction } from '../src/middleware/request-context.js';

test('records the authenticated admin actor, action, and target after a successful response', async () => {
  const reservationId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const req = {
    method: 'PUT',
    requestId: 'request-1',
    originalUrl: `/api/v1/admin/reservations/${reservationId}/status?private=value`,
  };
  const res = new EventEmitter();
  res.statusCode = 200;
  let inserted;
  let nextCalled = false;
  const middleware = createAdminAuditAction(async (sql, params) => {
    inserted = { sql, params };
  });

  middleware(req, res, () => { nextCalled = true; });
  req.user = { id: 'admin-user-id' };
  res.emit('finish');
  await Promise.resolve();

  assert.equal(nextCalled, true);
  assert.match(inserted.sql, /action, target_id/);
  assert.deepEqual(inserted.params, [
    'request-1',
    'admin-user-id',
    'PUT',
    `/api/v1/admin/reservations/${reservationId}/status`,
    200,
    'put /api/v1/admin/reservations/:id/status',
    reservationId,
  ]);
});

test('does not audit reads or failed admin responses', () => {
  let insertCount = 0;
  const middleware = createAdminAuditAction(async () => { insertCount++; });
  const readResponse = new EventEmitter();
  readResponse.statusCode = 200;
  middleware({ method: 'GET', originalUrl: '/api/v1/admin/dashboard' }, readResponse, () => {});
  readResponse.emit('finish');

  const failedResponse = new EventEmitter();
  failedResponse.statusCode = 403;
  middleware({ method: 'POST', originalUrl: '/api/v1/admin/settings' }, failedResponse, () => {});
  failedResponse.emit('finish');
  assert.equal(insertCount, 0);
});
