import pkg from 'pg';
const { Pool } = pkg;
let pool = null;
export function getPool() {
    if (!pool) {
        pool = new Pool({
            host: process.env.DB_HOST || 'postgresql',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'press_release_db',
            user: process.env.DB_USER || 'press_release',
            password: process.env.DB_PASSWORD || 'press_release',
        });
    }
    return pool;
}
