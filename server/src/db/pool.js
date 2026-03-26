import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'drenas_rentacar',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  multipleStatements: true,
});

// Helper that mimics pg-style { rows } return and converts $N placeholders to ?
export async function query(sql, params = []) {
  let mysqlSql = sql;
  // Replace $N placeholders with ? (from highest to lowest to avoid $1 matching $10)
  const maxParam = params.length;
  for (let i = maxParam; i >= 1; i--) {
    mysqlSql = mysqlSql.replaceAll(`$${i}`, '?');
  }
  // Remove PostgreSQL-specific type casts like ::car_category, ::numeric, ::fuel_type, etc.
  mysqlSql = mysqlSql.replace(/::\w+/g, '');

  const [rows] = await pool.execute(mysqlSql, params);
  return { rows };
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
