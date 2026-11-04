import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin, requireManager, requireOwner } from '../src/middleware/admin.js';

function run(middleware, user) {
  const req = { user };
  let nextCalled = false;
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  middleware(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('requires authentication before applying admin roles', () => {
  const result = run(requireAdmin, null);
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('allows staff into admin routes but not manager-only routes', () => {
  assert.equal(run(requireAdmin, { role: 'staff' }).nextCalled, true);
  assert.equal(run(requireManager, { role: 'staff' }).res.statusCode, 403);
});

test('allows manager and owner for manager-only routes and only owner for owner routes', () => {
  assert.equal(run(requireManager, { role: 'manager' }).nextCalled, true);
  assert.equal(run(requireManager, { role: 'owner' }).nextCalled, true);
  assert.equal(run(requireOwner, { role: 'manager' }).res.statusCode, 403);
  assert.equal(run(requireOwner, { role: 'owner' }).nextCalled, true);
});
