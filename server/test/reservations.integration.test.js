import 'dotenv/config';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../src/db/pool.js';
import { createAdminAuditAction } from '../src/middleware/request-context.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshSessions,
  rotateRefreshToken,
} from '../src/services/refresh-tokens.js';
import {
  createReservation,
  checkCarAvailability,
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
    assert.equal(await checkCarAvailability(connectionA, carId, pickupDate, dropoffDate), false);

    const boundaryReservation = await createReservation(connectionA, {
      data: { ...request, pickup_date: dropoffDate, dropoff_date: adjacentDropoff },
    });
    assert.ok(boundaryReservation.id);
    assert.equal(await checkCarAvailability(connectionA, carId, adjacentDropoff, nextDropoff), true);
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
    assert.equal(await checkCarAvailability(connectionA, carId, nextDropoff, localDateTime(26)), false);
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

test('MySQL serializes booking against reactivation and extension against cancellation races', { skip: !enabled }, async () => {
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
  const reactivatedId = uuidv4();
  const extendableId = uuidv4();
  const cancellableId = uuidv4();
  const statusSummaryId = uuidv4();

  try {
    setup = await mysql.createConnection(connectionOptions);
    connectionA = await mysql.createConnection(connectionOptions);
    connectionB = await mysql.createConnection(connectionOptions);
    await setup.execute('INSERT INTO locations (id, name, is_active) VALUES (?, ?, true), (?, ?, true)', [
      pickupLocation, 'Race test pickup', dropoffLocation, 'Race test dropoff',
    ]);
    await setup.execute(
      `INSERT INTO cars (id, brand, model, year, slug, category, fuel, transmission, price_per_day)
       VALUES (?, 'Race', 'Test', 2030, ?, 'economy', 'petrol', 'manual', 12.00)`,
      [carId, `reservation-race-${carId}`]
    );

    async function insertReservation(id, pickupOffset, dropoffOffset, status) {
      await setup.execute(`
        INSERT INTO reservations (id, reservation_no, car_id, pickup_location, dropoff_location,
          pickup_date, dropoff_date, status, total_days, daily_rate, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 12.00, 24.00)
      `, [
        id,
        `TST-${uuidv4().replace(/-/g, '').slice(0, 12)}`,
        carId,
        pickupLocation,
        dropoffLocation,
        localDateTime(pickupOffset).replace('T', ' '),
        localDateTime(dropoffOffset).replace('T', ' '),
        status,
        dropoffOffset - pickupOffset,
      ]);
    }

    await insertReservation(reactivatedId, 30, 32, 'cancelled');
    const bookingRequest = {
      car_id: carId,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      pickup_date: localDateTime(30),
      dropoff_date: localDateTime(32),
      extras: [],
    };
    const bookingVsReactivation = await Promise.allSettled([
      createReservation(connectionA, { data: bookingRequest }),
      updateReservationStatus(connectionB, reactivatedId, 'confirmed'),
    ]);
    assert.equal(bookingVsReactivation.filter(result => result.status === 'fulfilled').length, 1);
    const reactivationConflict = bookingVsReactivation.find(result => result.status === 'rejected');
    assert.ok(reactivationConflict?.reason instanceof ReservationError);
    assert.equal(reactivationConflict.reason.status, 409);

    const [activeBookings] = await setup.execute(`
      SELECT id FROM reservations
      WHERE car_id = ? AND status IN ('pending', 'confirmed', 'active')
        AND pickup_date < ? AND dropoff_date > ?
    `, [carId, localDateTime(32).replace('T', ' '), localDateTime(30).replace('T', ' ')]);
    assert.equal(activeBookings.length, 1);

    await insertReservation(extendableId, 40, 42, 'pending');
    await insertReservation(cancellableId, 42, 44, 'pending');
    const extensionVsCancellation = await Promise.allSettled([
      extendReservation(connectionA, extendableId, 1),
      updateReservationStatus(connectionB, cancellableId, 'cancelled'),
    ]);
    assert.equal(extensionVsCancellation[1].status, 'fulfilled');
    if (extensionVsCancellation[0].status === 'rejected') {
      assert.ok(extensionVsCancellation[0].reason instanceof ReservationError);
      assert.equal(extensionVsCancellation[0].reason.status, 409);
    }

    const [overlaps] = await setup.execute(`
      SELECT first_booking.id
      FROM reservations first_booking
      JOIN reservations second_booking
        ON second_booking.car_id = first_booking.car_id
        AND second_booking.id > first_booking.id
        AND first_booking.pickup_date < second_booking.dropoff_date
        AND first_booking.dropoff_date > second_booking.pickup_date
      WHERE first_booking.car_id = ?
        AND first_booking.status IN ('pending', 'confirmed', 'active')
        AND second_booking.status IN ('pending', 'confirmed', 'active')
    `, [carId]);
    assert.equal(overlaps.length, 0);

    await insertReservation(statusSummaryId, 50, 52, 'pending');
    const statusSummary = await updateReservationStatus(connectionA, statusSummaryId, 'confirmed');
    assert.deepEqual(statusSummary, { status: { from: 'pending', to: 'confirmed' } });
  } finally {
    try {
      if (setup) {
        await setup.execute('DELETE FROM reservations WHERE car_id = ?', [carId]);
        await setup.execute('DELETE FROM cars WHERE id = ?', [carId]);
        await setup.execute('DELETE FROM locations WHERE id IN (?, ?)', [pickupLocation, dropoffLocation]);
      }
    } finally {
      await Promise.all([setup, connectionA, connectionB].filter(Boolean).map(connection => connection.end()));
    }
  }
});

test('MySQL extension reprices extras, preserves fixed discounts, and rejects terminal states', { skip: !enabled }, async () => {
  const connectionOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drenas_rentacar',
  };
  let setup;
  let connection;
  const carId = uuidv4();
  const pickupLocation = uuidv4();
  const dropoffLocation = uuidv4();
  const extraId = uuidv4();

  try {
    setup = await mysql.createConnection(connectionOptions);
    connection = await mysql.createConnection(connectionOptions);
    await setup.execute('INSERT INTO locations (id, name, is_active) VALUES (?, ?, true), (?, ?, true)', [
      pickupLocation, 'Extension test pickup', dropoffLocation, 'Extension test dropoff',
    ]);
    await setup.execute(
      `INSERT INTO cars (id, brand, model, year, slug, category, fuel, transmission, price_per_day)
       VALUES (?, 'Extension', 'Test', 2030, ?, 'economy', 'petrol', 'manual', 10.10)`,
      [carId, `reservation-extension-${carId}`]
    );
    await setup.execute(
      'INSERT INTO extras (id, name, price_per_day, is_active) VALUES (?, ?, 3.25, true)',
      [extraId, 'Extension test extra']
    );

    const reservation = await createReservation(connection, {
      data: {
        car_id: carId,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        pickup_date: localDateTime(60),
        dropoff_date: localDateTime(62),
        extras: [{ extra_id: extraId, quantity: 2 }],
      },
    });
    assert.equal(String(reservation.extras_total), '13.00');
    assert.equal(String(reservation.total_price), '33.20');
    await setup.execute(
      'UPDATE reservations SET discount = 5.00, total_price = 28.20 WHERE id = ?',
      [reservation.id]
    );

    const changeSummary = await extendReservation(connection, reservation.id, 2);
    assert.equal(changeSummary.total_days.from, 2);
    assert.equal(changeSummary.total_days.to, 4);
    assert.deepEqual(changeSummary.extras_total, { from: '13.00', to: '26.00' });
    assert.deepEqual(changeSummary.total_price, { from: '28.20', to: '61.40' });

    let [saved] = await setup.execute(
      'SELECT total_days, extras_total, discount, total_price FROM reservations WHERE id = ?',
      [reservation.id]
    );
    assert.equal(saved[0].total_days, 4);
    assert.equal(String(saved[0].extras_total), '26.00');
    assert.equal(String(saved[0].discount), '5.00');
    assert.equal(String(saved[0].total_price), '61.40');
    let [lineItems] = await setup.execute(
      'SELECT extra_id, quantity, price FROM reservation_extras WHERE reservation_id = ?',
      [reservation.id]
    );
    assert.deepEqual(lineItems.map(item => ({
      extra_id: item.extra_id,
      quantity: item.quantity,
      price: String(item.price),
    })), [{ extra_id: extraId, quantity: 2, price: '26.00' }]);

    await setup.execute('UPDATE reservations SET discount = 1000.00 WHERE id = ?', [reservation.id]);
    await extendReservation(connection, reservation.id, 1);
    [saved] = await setup.execute(
      'SELECT total_days, extras_total, total_price FROM reservations WHERE id = ?',
      [reservation.id]
    );
    assert.equal(saved[0].total_days, 5);
    assert.equal(String(saved[0].extras_total), '32.50');
    assert.equal(String(saved[0].total_price), '0.00');
    [lineItems] = await setup.execute(
      'SELECT price FROM reservation_extras WHERE reservation_id = ?',
      [reservation.id]
    );
    assert.equal(String(lineItems[0].price), '32.50');

    await setup.execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservation.id]);
    await assert.rejects(
      extendReservation(connection, reservation.id, 1),
      error => error instanceof ReservationError && error.status === 400
    );
  } finally {
    try {
      if (setup) {
        await setup.execute('DELETE FROM reservations WHERE car_id = ?', [carId]);
        await setup.execute('DELETE FROM extras WHERE id = ?', [extraId]);
        await setup.execute('DELETE FROM cars WHERE id = ?', [carId]);
        await setup.execute('DELETE FROM locations WHERE id IN (?, ?)', [pickupLocation, dropoffLocation]);
      }
    } finally {
      await Promise.all([setup, connection].filter(Boolean).map(current => current.end()));
    }
  }
});

test('MySQL persists admin audit action, target, and structured change summary', { skip: !enabled }, async () => {
  const requestId = uuidv4();
  const targetId = uuidv4();
  const summary = { status: { from: 'pending', to: 'confirmed' } };
  let insertPromise;
  const middleware = createAdminAuditAction((sql, params) => {
    insertPromise = query(sql, params);
    return insertPromise;
  });
  const req = {
    method: 'PUT',
    requestId,
    originalUrl: `/api/v1/admin/reservations/${targetId}/status`,
    auditChangeSummary: summary,
    user: { id: null },
  };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headersSent = false;
  res.removeHeader = () => {};
  res.end = () => res;

  try {
    middleware(req, res, () => {});
    res.end();
    await insertPromise;
    const { rows } = await query(
      'SELECT action, target_id, change_summary FROM admin_audit_log WHERE request_id = $1',
      [requestId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, 'put /api/v1/admin/reservations/:id/status');
    assert.equal(rows[0].target_id, targetId);
    const savedSummary = typeof rows[0].change_summary === 'string'
      ? JSON.parse(rows[0].change_summary)
      : rows[0].change_summary;
    assert.deepEqual(savedSummary, summary);
  } finally {
    await query('DELETE FROM admin_audit_log WHERE request_id = $1', [requestId]);
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
