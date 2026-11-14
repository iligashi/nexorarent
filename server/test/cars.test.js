import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCar, toPublicCar } from '../src/utils/cars.js';

test('toPublicCar removes the VIN and license plate', () => {
  const car = { id: 'c1', brand: 'BMW', vin: 'WBA123', license_plate: '01-123-AB', features: '["GPS"]' };

  const publicCar = toPublicCar(car);

  assert.equal('vin' in publicCar, false);
  assert.equal('license_plate' in publicCar, false);
  assert.deepEqual(publicCar.features, ['GPS']);
  assert.equal(publicCar.brand, 'BMW');
});

test('parseCar keeps every field for admin routes', () => {
  const car = parseCar({ id: 'c1', vin: 'WBA123', license_plate: '01-123-AB', features: null });

  assert.equal(car.vin, 'WBA123');
  assert.equal(car.license_plate, '01-123-AB');
  assert.deepEqual(car.features, []);
});

test('parseCar falls back to an empty list on invalid JSON', () => {
  assert.deepEqual(parseCar({ features: '{oops' }).features, []);
});
