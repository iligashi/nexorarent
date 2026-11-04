import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const occupyingStatuses = ['pending', 'confirmed', 'active'];

function isValidLocalDateTime(value) {
  if (!dateTimePattern.test(value)) return false;
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && parsed.getUTCHours() === hour
    && parsed.getUTCMinutes() === minute
    && parsed.getUTCSeconds() === second;
}

const reservationBaseSchema = z.object({
  car_id: z.string().uuid(),
  pickup_location: z.string().uuid(),
  dropoff_location: z.string().uuid(),
  pickup_date: z.string().refine(isValidLocalDateTime, 'Use a valid local date and time (YYYY-MM-DDTHH:mm:ss)'),
  dropoff_date: z.string().refine(isValidLocalDateTime, 'Use a valid local date and time (YYYY-MM-DDTHH:mm:ss)'),
  guest_name: z.string().trim().min(1).max(200).optional(),
  guest_email: z.string().trim().email().max(255).optional(),
  guest_phone: z.string().trim().max(30).optional(),
  notes: z.string().max(5000).optional(),
  extras: z.array(z.object({
    extra_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(20).default(1),
  })).max(20).optional(),
});

function validateUniqueExtras(data, ctx) {
  if (isValidLocalDateTime(data.pickup_date)
    && isValidLocalDateTime(data.dropoff_date)
    && localDateTimeToMillis(data.dropoff_date) <= localDateTimeToMillis(data.pickup_date)) {
    ctx.addIssue({
      code: 'custom',
      path: ['dropoff_date'],
      message: 'Dropoff date must be after pickup date',
    });
  }

  const extras = data.extras || [];
  if (new Set(extras.map(extra => extra.extra_id)).size !== extras.length) {
    ctx.addIssue({ code: 'custom', path: ['extras'], message: 'Each extra may only be selected once' });
  }
}

export const reservationSchema = reservationBaseSchema.superRefine(validateUniqueExtras);

export const adminReservationSchema = reservationBaseSchema
  .omit({ guest_name: true, guest_email: true, guest_phone: true })
  .extend({
    customer_name: z.string().trim().min(1).max(200),
    customer_email: z.string().trim().email().max(255).optional(),
    customer_phone: z.string().trim().max(30).optional(),
    admin_notes: z.string().max(5000).optional(),
    status: z.enum(['pending', 'confirmed', 'active']).optional(),
  })
  .superRefine(validateUniqueExtras);

export class ReservationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function decimalToMinorUnits(value, decimalPlaces = 2) {
  const text = String(value);
  const match = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`Invalid decimal value from database: ${text}`);
  const fraction = (match[2] || '').padEnd(decimalPlaces, '0');
  if (fraction.length > decimalPlaces) throw new Error(`Unexpected decimal precision: ${text}`);
  return BigInt(match[1]) * (10n ** BigInt(decimalPlaces)) + BigInt(fraction || '0');
}

function minorUnitsToDecimal(value) {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function multiplyByBasisPoints(value, basisPoints) {
  return (value * basisPoints + 5000n) / 10000n;
}

function localDateTimeToMillis(value) {
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function toMysqlDateTime(value) {
  return value.replace('T', ' ');
}

async function connQuery(conn, sql, params = []) {
  const expandedParams = [];
  const mysqlSql = sql.replace(/\$(\d+)/g, (_, index) => {
    expandedParams.push(params[Number(index) - 1]);
    return '?';
  });
  const [rows] = await conn.execute(mysqlSql, expandedParams);
  return rows;
}

async function acquireCarReservationLock(conn, carId) {
  const lockName = `nexorarent:reservation:${carId}`;
  const result = await connQuery(conn, 'SELECT GET_LOCK($1, 30) AS acquired', [lockName]);
  if (Number(result[0]?.acquired) !== 1) {
    throw new ReservationError(503, 'Reservation system is busy; try again shortly');
  }
  return async () => {
    const released = await connQuery(conn, 'SELECT RELEASE_LOCK($1) AS released', [lockName]);
    if (Number(released[0]?.released) !== 1) {
      throw new Error(`Could not release the reservation lock for car ${carId}`);
    }
  };
}

function generateReservationNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `DRC-${date}-${randomInt(100000, 1000000)}`;
}

export async function createReservation(conn, { data, userId = null, adminNotes = null, status = 'pending' }) {
  let transactionStarted = false;
  let releaseCarLock;
  let operationError;
  try {
    const pickupMillis = localDateTimeToMillis(data.pickup_date);
    const dropoffMillis = localDateTimeToMillis(data.dropoff_date);
    if (dropoffMillis <= pickupMillis) {
      throw new ReservationError(400, 'Dropoff date must be after pickup date');
    }

    releaseCarLock = await acquireCarReservationLock(conn, data.car_id);
    await conn.beginTransaction();
    transactionStarted = true;

    const cars = await connQuery(conn, 'SELECT price_per_day, is_available FROM cars WHERE id = $1 FOR UPDATE', [data.car_id]);
    if (!cars.length) throw new ReservationError(404, 'Car not found');
    if (!cars[0].is_available) throw new ReservationError(409, 'Car is not available');

    const overlaps = await connQuery(conn, `
      SELECT id FROM reservations
      WHERE car_id = $1 AND status IN ('pending', 'confirmed', 'active')
        AND pickup_date < $3 AND dropoff_date > $2
      LIMIT 1 FOR UPDATE
    `, [data.car_id, toMysqlDateTime(data.pickup_date), toMysqlDateTime(data.dropoff_date)]);
    if (overlaps.length) throw new ReservationError(409, 'Car is not available for selected dates');

    const locations = await connQuery(conn, `
      SELECT id FROM locations
      WHERE is_active = true AND (id = $1 OR id = $2)
    `, [data.pickup_location, data.dropoff_location]);
    const activeLocationIds = new Set(locations.map(location => location.id));
    if (!activeLocationIds.has(data.pickup_location) || !activeLocationIds.has(data.dropoff_location)) {
      throw new ReservationError(400, 'Pickup and dropoff locations must be active');
    }

    const totalDays = Math.max(1, Math.ceil((dropoffMillis - pickupMillis) / 86400000));
    const dailyRateCents = decimalToMinorUnits(cars[0].price_per_day);
    const seasonal = await connQuery(conn, `
      SELECT multiplier FROM seasonal_pricing
      WHERE car_id = $1 AND start_date <= DATE($2) AND end_date >= DATE($3)
      LIMIT 1
    `, [data.car_id, toMysqlDateTime(data.pickup_date), toMysqlDateTime(data.dropoff_date)]);
    const multiplierBasisPoints = seasonal.length
      ? decimalToMinorUnits(seasonal[0].multiplier, 2) * 100n
      : 10000n;
    const chargedDailyRateCents = multiplyByBasisPoints(dailyRateCents, multiplierBasisPoints);
    const basePriceCents = chargedDailyRateCents * BigInt(totalDays);

    const extras = data.extras || [];
    const extrasToInsert = [];
    if (extras.length) {
      const placeholders = extras.map((_, index) => `$${index + 1}`).join(', ');
      const extraRows = await connQuery(
        conn,
        `SELECT id, price_per_day FROM extras WHERE is_active = true AND id IN (${placeholders})`,
        extras.map(extra => extra.extra_id)
      );
      const priceById = new Map(extraRows.map(extra => [extra.id, extra.price_per_day]));
      if (priceById.size !== extras.length) {
        throw new ReservationError(400, 'One or more selected extras are unavailable');
      }

      for (const extra of extras) {
        const priceCents = decimalToMinorUnits(priceById.get(extra.extra_id))
          * BigInt(totalDays)
          * BigInt(extra.quantity);
        extrasToInsert.push({ ...extra, priceCents });
      }
    }

    const extrasTotalCents = extrasToInsert.reduce((total, extra) => total + extra.priceCents, 0n);
    const reservationId = uuidv4();
    const reservationNo = generateReservationNo();
    await connQuery(conn, `
      INSERT INTO reservations (id, reservation_no, user_id, car_id, pickup_location, dropoff_location,
        pickup_date, dropoff_date, status, total_days, daily_rate, extras_total, total_price,
        guest_name, guest_email, guest_phone, notes, admin_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      reservationId, reservationNo, userId, data.car_id, data.pickup_location, data.dropoff_location,
      toMysqlDateTime(data.pickup_date), toMysqlDateTime(data.dropoff_date), status, totalDays,
      minorUnitsToDecimal(chargedDailyRateCents), minorUnitsToDecimal(extrasTotalCents),
      minorUnitsToDecimal(basePriceCents + extrasTotalCents),
      data.guest_name || data.customer_name || null,
      data.guest_email || data.customer_email || null,
      data.guest_phone || data.customer_phone || null,
      data.notes || null, adminNotes || data.admin_notes || null,
    ]);

    for (const extra of extrasToInsert) {
      await connQuery(conn,
        'INSERT INTO reservation_extras (id, reservation_id, extra_id, quantity, price) VALUES ($1,$2,$3,$4,$5)',
        [uuidv4(), reservationId, extra.extra_id, extra.quantity, minorUnitsToDecimal(extra.priceCents)]
      );
    }

    const reservation = await connQuery(conn, 'SELECT * FROM reservations WHERE id = $1', [reservationId]);
    await conn.commit();
    transactionStarted = false;
    return reservation[0];
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    operationError = error;
    throw error;
  } finally {
    if (releaseCarLock) {
      try {
        await releaseCarLock();
      } catch (releaseError) {
        if (operationError) {
          throw new AggregateError([operationError, releaseError], 'Reservation failed and its advisory lock could not be released');
        }
        throw releaseError;
      }
    }
  }
}

export async function updateReservationStatus(conn, reservationId, status, adminNotes) {
  let transactionStarted = false;
  let releaseCarLock;
  let operationError;
  try {
    const existing = await connQuery(conn, 'SELECT car_id FROM reservations WHERE id = $1', [reservationId]);
    if (!existing.length) throw new ReservationError(404, 'Reservation not found');

    releaseCarLock = await acquireCarReservationLock(conn, existing[0].car_id);
    await conn.beginTransaction();
    transactionStarted = true;
    const cars = await connQuery(conn, 'SELECT is_available FROM cars WHERE id = $1 FOR UPDATE', [existing[0].car_id]);
    if (!cars.length) throw new ReservationError(404, 'Car not found');
    if (occupyingStatuses.includes(status) && !cars[0].is_available) {
      throw new ReservationError(409, 'Car is not available');
    }
    const reservations = await connQuery(conn, 'SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [reservationId]);
    if (!reservations.length) throw new ReservationError(404, 'Reservation not found');

    if (occupyingStatuses.includes(status)) {
      const overlaps = await connQuery(conn, `
        SELECT id FROM reservations
        WHERE car_id = $1 AND id <> $2 AND status IN ('pending', 'confirmed', 'active')
          AND pickup_date < $4 AND dropoff_date > $3
        LIMIT 1 FOR UPDATE
      `, [
        existing[0].car_id,
        reservationId,
        reservations[0].pickup_date,
        reservations[0].dropoff_date,
      ]);
      if (overlaps.length) throw new ReservationError(409, 'Car is not available for selected dates');
    }

    await connQuery(conn,
      'UPDATE reservations SET status = $1, admin_notes = COALESCE($2, admin_notes) WHERE id = $3',
      [status, adminNotes || null, reservationId]
    );
    await conn.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    operationError = error;
    throw error;
  } finally {
    if (releaseCarLock) {
      try {
        await releaseCarLock();
      } catch (releaseError) {
        if (operationError) {
          throw new AggregateError([operationError, releaseError], 'Reservation status update failed and its advisory lock could not be released');
        }
        throw releaseError;
      }
    }
  }
}

export async function extendReservation(conn, reservationId, extraDays) {
  let transactionStarted = false;
  let releaseCarLock;
  let operationError;
  try {
    const existing = await connQuery(conn, `
      SELECT car_id FROM reservations WHERE id = $1
    `, [reservationId]);
    if (!existing.length) throw new ReservationError(404, 'Reservation not found');

    releaseCarLock = await acquireCarReservationLock(conn, existing[0].car_id);
    await conn.beginTransaction();
    transactionStarted = true;
    await connQuery(conn, 'SELECT id FROM cars WHERE id = $1 FOR UPDATE', [existing[0].car_id]);
    const reservations = await connQuery(conn, `
      SELECT r.*, DATE_FORMAT(r.pickup_date, '%Y-%m-%dT%H:%i:%s') AS pickup_iso,
        DATE_FORMAT(r.dropoff_date, '%Y-%m-%dT%H:%i:%s') AS dropoff_iso
      FROM reservations r WHERE r.id = $1 FOR UPDATE
    `, [reservationId]);
    if (!reservations.length) throw new ReservationError(404, 'Reservation not found');
    const reservation = reservations[0];
    if (['completed', 'cancelled', 'rejected'].includes(reservation.status)) {
      throw new ReservationError(400, `Cannot extend a ${reservation.status} reservation`);
    }

    const pickupMillis = localDateTimeToMillis(reservation.pickup_iso);
    const dropoffDate = new Date(`${reservation.dropoff_iso}Z`);
    dropoffDate.setUTCDate(dropoffDate.getUTCDate() + extraDays);
    const newDropoff = dropoffDate.toISOString().slice(0, 19).replace('T', ' ');
    const overlaps = await connQuery(conn, `
      SELECT id FROM reservations
      WHERE car_id = $1 AND id <> $2 AND status IN ('pending', 'confirmed', 'active')
        AND pickup_date < $4 AND dropoff_date > $3
      LIMIT 1 FOR UPDATE
    `, [existing[0].car_id, reservationId, reservation.pickup_iso.replace('T', ' '), newDropoff]);
    if (overlaps.length) throw new ReservationError(409, 'Car is not available for the extended dates');

    const newDropoffMillis = localDateTimeToMillis(newDropoff.replace(' ', 'T'));
    const newTotalDays = Math.max(1, Math.ceil((newDropoffMillis - pickupMillis) / 86400000));
    const dailyRateCents = decimalToMinorUnits(reservation.daily_rate);
    const oldExtrasCents = decimalToMinorUnits(reservation.extras_total || 0);
    const discountCents = decimalToMinorUnits(reservation.discount || 0);
    const newExtrasCents = (oldExtrasCents * BigInt(newTotalDays) + BigInt(reservation.total_days) / 2n)
      / BigInt(reservation.total_days);
    const grossCents = dailyRateCents * BigInt(newTotalDays) + newExtrasCents;
    const totalPriceCents = grossCents > discountCents ? grossCents - discountCents : 0n;
    await connQuery(conn, `
      UPDATE reservations SET dropoff_date = $1, total_days = $2, extras_total = $3, total_price = $4
      WHERE id = $5
    `, [
      newDropoff, newTotalDays, minorUnitsToDecimal(newExtrasCents),
      minorUnitsToDecimal(totalPriceCents), reservationId,
    ]);
    await conn.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    operationError = error;
    throw error;
  } finally {
    if (releaseCarLock) {
      try {
        await releaseCarLock();
      } catch (releaseError) {
        if (operationError) {
          throw new AggregateError([operationError, releaseError], 'Reservation extension failed and its advisory lock could not be released');
        }
        throw releaseError;
      }
    }
  }
}

export function calculateRentalDays(pickupDate, dropoffDate) {
  if (!isValidLocalDateTime(pickupDate) || !isValidLocalDateTime(dropoffDate)) {
    throw new ReservationError(400, 'Pickup and dropoff dates must be valid');
  }
  const duration = localDateTimeToMillis(dropoffDate) - localDateTimeToMillis(pickupDate);
  if (duration <= 0) throw new ReservationError(400, 'Dropoff date must be after pickup date');
  return Math.max(1, Math.ceil(duration / 86400000));
}
