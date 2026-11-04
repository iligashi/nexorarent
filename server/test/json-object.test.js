import test from 'node:test';
import assert from 'node:assert/strict';
import { requireJsonObject } from '../src/middleware/json-object.js';

function run(contentType, body) {
  const req = {
    body,
    is: type => contentType === type,
  };
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  let nextCalled = false;
  requireJsonObject(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('rejects JSON primitives and arrays', () => {
  for (const body of [null, 'text', 1, true, []]) {
    assert.equal(run('application/json', body).res.statusCode, 400);
  }
});

test('accepts JSON objects and leaves non-JSON requests unchanged', () => {
  assert.equal(run('application/json', {}).nextCalled, true);
  assert.equal(run('multipart/form-data', undefined).nextCalled, true);
});
