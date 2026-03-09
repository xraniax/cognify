import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// All DB credentials come exclusively from environment variables (never hardcoded)
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,              // Max number of clients in the pool
    idleTimeoutMillis: 30_000,  // Release idle clients after 30s
    connectionTimeoutMillis: 5_000, // Fail fast if DB unreachable (5s)
});

// Log successful first connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL');
});

// Unexpected idle client errors – log but do not crash the process
pool.on('error', (err) => {
    console.error('❌ Unexpected PostgreSQL idle client error:', err.message);
});

/**
 * Executes a parameterized SQL query.
 * Using parameterized queries prevents SQL injection.
 */
export const query = (text, params) => pool.query(text, params);
export default pool;
