import 'dotenv/config';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('E2E admin setup is allowed only with NODE_ENV=test');
}

const email = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@nexorarent.test';
const password = process.env.E2E_ADMIN_PASSWORD || 'TestAdminPassword!2026';
const passwordHash = await bcrypt.hash(password, 10);
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'drenas_rentacar',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
});

try {
  await connection.execute(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
    VALUES (?, ?, ?, 'E2E', 'Admin', 'owner', true)
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'owner', is_verified = true
  `, [randomUUID(), email, passwordHash]);
} finally {
  await connection.end();
}
