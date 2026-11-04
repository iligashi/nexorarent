import 'dotenv/config';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import pool from '../src/db/pool.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshSessions,
  rotateRefreshToken,
} from '../src/services/refresh-tokens.js';
import {
  createReservation,
  extendReservation,
  ReservationError,
  updateReservationStatus,
} from '../src/services/reservations.js';

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === '1';

after(async () => {
  await pool.end();
});

function localDateTime(daysFromNow) {
  const date = new Date(Date.now() + daysFromNow * 86400000);
  return date.toISOString().slice(0, 19);
}

function sqlDate(value) {
  return value.slice(0, 10);
}

test('MySQL serializes overlapping public/admin reservations and enforces booking rules', { skip: !enabled }, async () => {
  const connectionOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drenas_rentacar',
  };
  let setup;
  let connectionA;
  let connectionB;
  const carId = uuidv4();
  const pickupLocation = uuidv4();
  const dropoffLocation = uuidv4();
  const extraId = uuidv4();
  const pickupDate = localDateTime(21);
  const dropoffDate = localDateTime(23);
  const adjacentDropoff = localDateTime(24);
  const nextDropoff = localDateTime(25);
  const invalidExtraId = uuidv4();

  try {
    setup = await mysql.createConnection(connectionOptions);
    connectionA = await mysql.createConnection(connectionOptions);
    connectionB = await mysql.createConnection(connectionOptions);
    await setup.execute('INSERT INTO locations (id, name, is_active) VALUES (?, ?, true), (?, ?, true)', [
      pickupLocation, 'Reservation test pickup', dropoffLocation, 'Reservation test dropoff',
    ]);
    await setup.execute(
      `INSERT INTO cars (id, brand, model, year, slug, category, fuel, transmission, price_per_day)
       VALUES (?, 'Test', 'Car', 2030, ?, 'economy', 'petrol', 'manual', 10.10)`,
      [carId, `reservation-test-${carId}`]
    );
    await setup.execute(
      'INSERT INTO extras (id, name, price_per_day, is_active) VALUES (?, ?, 3.25, true)',
      [extraId, 'Reservation test extra']
    );
    await setup.execute(
      'INSERT INTO seasonal_pricing (id, car_id, start_date, end_date, multiplier) VALUES (?, ?, ?, ?, 1.15)',
      [uuidv4(), carId, sqlDate(pickupDate), sqlDate(dropoffDate)]
    );

    const request = {
      car_id: carId,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      pickup_date: pickupDate,
      dropoff_date: dropoffDate,
      extras: [{ extra_id: extraId, quantity: 1 }],
    };
    const concurrent = await Promise.allSettled([
      createReservation(connectionA, { data: request, status: 'pending' }),
      createReservation(connectionB, {
        data: { ...request, customer_name: 'Admin customer' },
        status: 'confirmed',
      }),
    ]);
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = concurrent.find(result => result.status === 'rejected');
    assert.ok(rejected?.reason instanceof ReservationError);
    assert.equal(rejected.reason.status, 409);

    const [savedRows] = await setup.execute(
      'SELECT id, total_days, daily_rate, extras_total, total_price FROM reservations WHERE car_id = ? ORDER BY created_at LIMIT 1',
      [carId]
    );
    assert.equal(savedRows.length, 1);
    assert.equal(savedRows[0].total_days, 2);
    assert.equal(String(savedRows[0].daily_rate), '11.62');
    assert.equal(String(savedRows[0].extras_total), '6.50');
    assert.equal(String(savedRows[0].total_price), '29.74');

    const boundaryReservation = await createReservation(connectionA, {
      data: { ...request, pickup_date: dropoffDate, dropoff_date: adjacentDropoff },
    });
    assert.ok(boundaryReservation.id);
    await assert.rejects(
      extendReservation(connectionA, savedRows[0].id, 1),
      error => error instanceof ReservationError && error.status === 409
    );
    const cancelledReservationId = uuidv4();
    await setup.execute(`
      INSERT INTO reservations (id, reservation_no, car_id, pickup_location, dropoff_location,
        pickup_date, dropoff_date, status, total_days, daily_rate, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'cancelled', 2, 10.10, 20.20)
    `, [
      cancelledReservationId,
      `TST-${uuidv4().slice(0, 12)}`,
      carId,
      pickupLocation,
      dropoffLocation,
      pickupDate.replace('T', ' '),
      dropoffDate.replace('T', ' '),
    ]);
    await assert.rejects(
      updateReservationStatus(connectionA, cancelledReservationId, 'confirmed'),
      error => error instanceof ReservationError && error.status === 409
    );

    await assert.rejects(
      createReservation(connectionA, {
        data: { ...request, pickup_date: adjacentDropoff, dropoff_date: nextDropoff, extras: [{ extra_id: invalidExtraId, quantity: 1 }] },
      }),
      error => error instanceof ReservationError && error.status === 400
    );

    await setup.execute('UPDATE extras SET is_active = false WHERE id = ?', [extraId]);
    await assert.rejects(
      createReservation(connectionA, {
        data: { ...request, pickup_date: adjacentDropoff, dropoff_date: nextDropoff },
      }),
      error => error instanceof ReservationError && error.status === 400
    );

    await setup.execute('UPDATE cars SET is_available = false WHERE id = ?', [carId]);
    await assert.rejects(
      createReservation(connectionA, {
        data: { ...request, pickup_date: adjacentDropoff, dropoff_date: nextDropoff, extras: [] },
      }),
      error => error instanceof ReservationError && error.status === 409
    );
    await setup.execute('UPDATE cars SET is_available = true WHERE id = ?', [carId]);

    await setup.execute('UPDATE locations SET is_active = false WHERE id = ?', [pickupLocation]);
    await assert.rejects(
      createReservation(connectionA, {
        data: { ...request, pickup_date: adjacentDropoff, dropoff_date: nextDropoff, extras: [] },
      }),
      error => error instanceof ReservationError && error.status === 400
    );
  } finally {
    try {
      if (setup) {
        await setup.execute('DELETE FROM reservations WHERE car_id = ?', [carId]);
        await setup.execute('DELETE FROM seasonal_pricing WHERE car_id = ?', [carId]);
        await setup.execute('DELETE FROM extras WHERE id = ?', [extraId]);
        await setup.execute('DELETE FROM cars WHERE id = ?', [carId]);
        await setup.execute('DELETE FROM locations WHERE id IN (?, ?)', [pickupLocation, dropoffLocation]);
      }
    } finally {
      await Promise.all([setup, connectionA, connectionB].filter(Boolean).map(connection => connection.end()));
    }
  }
});

test('MySQL stores hashed refresh sessions, rotates once, and supports revocation', { skip: !enabled }, async () => {
  const options = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drenas_rentacar',
  };
  let conn;
  const userId = uuidv4();
  const email = `refresh-test-${userId}@example.test`;

  try {
    conn = await mysql.createConnection(options);
    await conn.execute(
      `INSERT INTO users (id, email, password_hash, first_name, last_name)
       VALUES (?, ?, 'test-hash', 'Refresh', 'Test')`,
      [userId, email]
    );

    const firstToken = await issueRefreshToken(userId);
    const firstHash = createHash('sha256').update(firstToken).digest('hex');
    const [sessions] = await conn.execute(
      'SELECT token_hash FROM refresh_token_sessions WHERE user_id = ?',
      [userId]
    );
    assert.deepEqual(sessions.map(session => session.token_hash), [firstHash]);

    const firstDecoded = jwt.verify(firstToken, process.env.JWT_REFRESH_SECRET);
    const rotations = await Promise.all([
      rotateRefreshToken(firstToken, firstDecoded),
      rotateRefreshToken(firstToken, firstDecoded),
    ]);
    assert.equal(rotations.filter(Boolean).length, 1);
    const rotated = rotations.find(Boolean);
    assert.ok(rotated?.refreshToken);
    assert.equal(await rotateRefreshToken(firstToken, firstDecoded), null);

    await revokeRefreshToken(rotated.refreshToken);
    const rotatedDecoded = jwt.verify(rotated.refreshToken, process.env.JWT_REFRESH_SECRET);
    assert.equal(await rotateRefreshToken(rotated.refreshToken, rotatedDecoded), null);

    const lastToken = await issueRefreshToken(userId);
    const lastDecoded = jwt.verify(lastToken, process.env.JWT_REFRESH_SECRET);
    await revokeUserRefreshSessions(userId);
    assert.equal(await rotateRefreshToken(lastToken, lastDecoded), null);
  } finally {
    try {
      if (conn) await conn.execute('DELETE FROM users WHERE id = ?', [userId]);
    } finally {
      await conn?.end();
    }
  }
});
