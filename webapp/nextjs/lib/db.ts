import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'press_release_db',
      user: process.env.DB_USER || 'press_release',
      password: process.env.DB_PASSWORD || 'press_release',
    });
  }
  return pool;
}

export function formatTimestamp(timestamp: Date): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  const microseconds = String(timestamp.getMilliseconds() * 1000).padStart(6, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${microseconds}`;
}
