import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminReservationSchema,
  calculateRentalDays,
  reservationSchema,
  ReservationError,
} from '../src/services/reservations.js';

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
