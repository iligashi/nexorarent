import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');
process.env.CONFIG_MODE = 'migration';
const { config, validateMigrationCredentials } = await import('../config.js');
const migrationLockName = `nexorarent:migrations:${createHash('sha256').update(config.DB_NAME).digest('hex').slice(0, 16)}`;

async function migrate() {
  validateMigrationCredentials(process.env);
  const conn = await mysql.createConnection({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.MIGRATION_DB_USER || config.DB_USER,
    password: config.MIGRATION_DB_PASSWORD ?? config.DB_PASSWORD,
    database: config.DB_NAME,
    multipleStatements: true,
  });

  try {
    const [lockRows] = await conn.query('SELECT GET_LOCK(?, 60) AS acquired', [migrationLockName]);
    if (lockRows[0]?.acquired !== 1) {
      throw new Error(`Could not acquire the migration lock for ${config.DB_NAME}`);
    }

    // Create migrations tracking table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const [rows] = await conn.query('SELECT 1 FROM _migrations WHERE name = ?', [file]);
      if (rows.length > 0) {
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await conn.query(sql);
        await conn.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
        console.log(`  ✔ ${file} applied`);
      } catch (err) {
        console.error(`  ✗ ${file} failed:`, err.message);
        throw err;
      }
    }

    console.log('\nMigrations complete.');
  } finally {
    try {
      await conn.query('SELECT RELEASE_LOCK(?)', [migrationLockName]);
    } finally {
      await conn.end();
    }
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
