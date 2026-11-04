import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { createAdminAuditAction } from '../src/middleware/request-context.js';

function createResponse(statusCode = 200) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.headersSent = false;
  res.headers = {};
  res.ended = false;
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.removeHeader = name => { delete res.headers[name]; };
  res.end = (...args) => {
    res.ended = true;
    res.endArgs = args;
    return res;
  };
  return res;
}

test('records the authenticated admin actor, action, and target after a successful response', async () => {
  const reservationId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const req = {
    method: 'PUT',
    requestId: 'request-1',
    originalUrl: `/api/v1/admin/reservations/${reservationId}/status?private=value`,
    auditChangeSummary: { status: { from: 'pending', to: 'confirmed' } },
  };
  const res = createResponse();
  let inserted;
  let nextCalled = false;
  const middleware = createAdminAuditAction(async (sql, params) => {
    inserted = { sql, params };
  });

  middleware(req, res, () => { nextCalled = true; });
  req.user = { id: 'admin-user-id' };
  res.end('success response');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(nextCalled, true);
  assert.equal(res.ended, true);
  assert.match(inserted.sql, /action, target_id/);
  assert.deepEqual(inserted.params, [
    'request-1',
    'admin-user-id',
    'PUT',
    `/api/v1/admin/reservations/${reservationId}/status`,
    200,
    'put /api/v1/admin/reservations/:id/status',
    reservationId,
    JSON.stringify({ status: { from: 'pending', to: 'confirmed' } }),
  ]);
  assert.match(inserted.sql, /target_id, change_summary/);
});

test('audits a successful mutation before ending the response and stores only changed field names', async () => {
  let resolveInsert;
  let capturedParams;
  const middleware = createAdminAuditAction((sql, params) => {
    capturedParams = params;
    return new Promise(resolve => { resolveInsert = resolve; });
  });
  const req = {
    method: 'PATCH',
    requestId: 'request-2',
    originalUrl: '/api/v1/admin/settings',
    user: { id: 'manager-id' },
    body: { company_email: 'private@example.test', api_secret: 'never-record-this' },
  };
  const res = createResponse();
  middleware(req, res, () => {});

  res.end('success response');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.ended, false);
  assert.deepEqual(JSON.parse(capturedParams[7]), {
    changed_fields: ['company_email', 'api_secret'],
  });
  assert.equal(JSON.stringify(capturedParams).includes('private@example.test'), false);

  resolveInsert();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.ended, true);
  assert.deepEqual(res.endArgs, ['success response']);
});

test('returns a server error rather than success when the audit insert fails', async () => {
  const middleware = createAdminAuditAction(async () => {
    throw new Error('audit database unavailable');
  });
  const req = {
    method: 'DELETE',
    requestId: 'request-3',
    originalUrl: '/api/v1/admin/cars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    user: { id: 'manager-id' },
  };
  const res = createResponse();
  middleware(req, res, () => {});

  res.end('success response');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.statusCode, 500);
  assert.deepEqual(JSON.parse(res.endArgs[0]), {
    error: 'Admin action could not be durably recorded',
    requestId: 'request-3',
  });
});

test('does not audit reads or failed admin responses', () => {
  let insertCount = 0;
  const middleware = createAdminAuditAction(async () => { insertCount++; });
  const readResponse = createResponse();
  middleware({ method: 'GET', originalUrl: '/api/v1/admin/dashboard' }, readResponse, () => {});
  readResponse.end('read response');

  const failedResponse = createResponse(403);
  middleware({ method: 'POST', originalUrl: '/api/v1/admin/settings' }, failedResponse, () => {});
  failedResponse.end('error response');
  assert.equal(insertCount, 0);
});
