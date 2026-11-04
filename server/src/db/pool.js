import mysql from 'mysql2/promise';
import { config } from '../config.js';

const pool = mysql.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  multipleStatements: true,
});

// Helper that mimics pg-style { rows } return and converts $N placeholders to ?
export async function query(sql, params = []) {
  let mysqlSql = sql;
  // Remove PostgreSQL-specific type casts like ::car_category, ::numeric, ::fuel_type, etc.
  mysqlSql = mysqlSql.replace(/::\w+/g, '');

  // Convert $N placeholders to ? and expand params for duplicate placeholders
  // e.g. "WHERE a = $1 OR b = $1" with params ['x'] → "WHERE a = ? OR b = ?" with params ['x', 'x']
  const expandedParams = [];
  mysqlSql = mysqlSql.replace(/\$(\d+)/g, (_, num) => {
    expandedParams.push(params[parseInt(num) - 1]);
    return '?';
  });

  const [rows] = await pool.query(mysqlSql, expandedParams);
  return { rows };
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
