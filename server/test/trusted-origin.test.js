import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { requireTrustedOrigin } from '../src/middleware/trusted-origin.js';

function run(origin) {
  const req = { get: name => name === 'origin' ? origin : undefined };
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
  let nextCalled = false;
  requireTrustedOrigin(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('allows configured origins and loopback development ports', () => {
  const configuredOrigin = config.CLIENT_URL.split(',')[0].trim();
  assert.equal(run(configuredOrigin).nextCalled, true);
  if (config.NODE_ENV === 'development') {
    assert.equal(run('http://localhost:3007').nextCalled, true);
  }
});

test('rejects missing and untrusted cookie request origins', () => {
  assert.equal(run(undefined).res.statusCode, 403);
  assert.equal(run('https://untrusted.example').res.statusCode, 403);
});
