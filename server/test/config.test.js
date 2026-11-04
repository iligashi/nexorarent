import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from '../src/config.js';

const productionEnvironment = {
  NODE_ENV: 'production',
  PORT: '4000',
  DB_HOST: 'db.example.com',
  DB_PORT: '3306',
  DB_NAME: 'rental',
  DB_USER: 'app',
  DB_PASSWORD: 'a-database-password',
  JWT_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  CLIENT_URL: 'https://rent.example.com',
};

test('accepts a configured production environment', () => {
  const config = validateEnvironment(productionEnvironment);
  assert.equal(config.NODE_ENV, 'production');
  assert.equal(config.PORT, 4000);
});

test('rejects missing production database settings and secrets', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    /DB_HOST is required in production/
  );
});

test('rejects weak or reused production JWT secrets', () => {
  assert.throws(
    () => validateEnvironment({
      ...productionEnvironment,
      JWT_SECRET: 'change-me',
    }),
    /JWT_SECRET must be at least 32 characters/
  );

  assert.throws(
    () => validateEnvironment({
      ...productionEnvironment,
      JWT_REFRESH_SECRET: productionEnvironment.JWT_SECRET,
    }),
    /must be different/
  );
});

test('requires HTTPS client origins in production', () => {
  assert.throws(
    () => validateEnvironment({
      ...productionEnvironment,
      CLIENT_URL: 'http://rent.example.com',
    }),
    /HTTPS origins/
  );
});
