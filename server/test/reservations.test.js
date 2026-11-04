import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminReservationSchema,
  calculateRentalDays,
  checkCarAvailability,
  guestReservationSchema,
  reservationSchema,
  ReservationError,
} from '../src/services/reservations.js';
import { registerSchema } from '../src/routes/auth.routes.js';

const validReservation = {
  car_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  pickup_location: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  dropoff_location: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
  pickup_date: '2030-01-10T10:00:00',
  dropoff_date: '2030-01-12T10:00:00',
};

test('rejects malformed, impossible, and non-positive reservation dates', () => {
  assert.equal(reservationSchema.safeParse({ ...validReservation, pickup_date: 'not-a-date' }).success, false);
  assert.equal(reservationSchema.safeParse({ ...validReservation, pickup_date: '2030-02-30T10:00:00' }).success, false);
  assert.throws(
    () => calculateRentalDays(validReservation.dropoff_date, validReservation.pickup_date),
    error => error instanceof ReservationError && error.status === 400
  );
});

test('availability rejects malformed dates before querying the database', async () => {
  let queried = false;
  await assert.rejects(
    checkCarAvailability({
      execute: async () => {
        queried = true;
        throw new Error('database must not be queried for invalid dates');
      },
    }, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'invalid', '2030-01-12T10:00:00'),
    error => error instanceof ReservationError && error.status === 400
  );
  assert.equal(queried, false);
});

test('calculates rental days with a half-open date boundary', () => {
  assert.equal(calculateRentalDays('2030-01-10T10:00:00', '2030-01-11T10:00:00'), 1);
  assert.equal(calculateRentalDays('2030-01-10T10:00:00', '2030-01-11T10:00:01'), 2);
});

test('validates admin booking customer data and active booking statuses', () => {
  assert.equal(adminReservationSchema.safeParse({
    ...validReservation,
    customer_name: 'Customer',
    status: 'confirmed',
  }).success, true);
  assert.equal(adminReservationSchema.safeParse({
    ...validReservation,
    customer_name: 'Customer',
    status: 'cancelled',
  }).success, false);
  assert.equal(adminReservationSchema.safeParse(validReservation).success, false);
});

test('rejects duplicate extras in a reservation request', () => {
  const extra = { extra_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', quantity: 1 };
  assert.equal(reservationSchema.safeParse({
    ...validReservation,
    extras: [extra, extra],
  }).success, false);
});

test('requires guest contact details for anonymous reservations', () => {
  const guest = {
    ...validReservation,
    guest_name: 'Guest Customer',
    guest_email: 'guest@example.test',
    guest_phone: '+38344123456',
  };
  assert.equal(guestReservationSchema.safeParse(guest).success, true);
  for (const field of ['guest_name', 'guest_email', 'guest_phone']) {
    const missing = { ...guest };
    delete missing[field];
    assert.equal(guestReservationSchema.safeParse(missing).success, false, `${field} is required`);
  }
  assert.equal(reservationSchema.safeParse(validReservation).success, true);
});

test('requires at least 12 characters for new registration passwords', () => {
  const user = {
    email: 'new-user@example.test',
    first_name: 'New',
    last_name: 'User',
    password: 'short',
  };
  assert.equal(registerSchema.safeParse(user).success, false);
  assert.equal(registerSchema.safeParse({ ...user, password: 'long-enough-password' }).success, true);
});
