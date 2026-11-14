// Columns that identify a physical vehicle. Only admins may read them.
const PRIVATE_CAR_FIELDS = ['vin', 'license_plate'];

// Parse features JSON string to array for MariaDB compatibility
export function parseCar(car) {
  if (!car) return car;
  if (typeof car.features === 'string') {
    try { car.features = JSON.parse(car.features); } catch { car.features = []; }
  }
  if (!car.features) car.features = [];
  return car;
}

// Shape of a car on public routes: parsed, without the private fields.
export function toPublicCar(car) {
  if (!car) return car;
  const publicCar = { ...parseCar(car) };
  for (const field of PRIVATE_CAR_FIELDS) delete publicCar[field];
  return publicCar;
}
