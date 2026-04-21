import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/utils/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');
const MIGRATIONS_DIR = process.env.DB_MIGRATIONS_DIR || DEFAULT_MIGRATIONS_DIR;

const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function ensureMigrationTable() {
    await query(MIGRATION_TABLE_SQL);
}

async function getAppliedMigrations() {
    const result = await query('SELECT filename FROM schema_migrations');
    return new Set(result.rows.map((row) => row.filename));
}

function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }

    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((filename) => filename.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));
}

async function applyMigration(filename) {
    const migrationPath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await query('BEGIN');
    try {
        await query(sql);
        await query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
            [filename]
        );
        await query('COMMIT');
        console.log(`[migrate] Applied ${filename}`);
    } catch (error) {
        await query('ROLLBACK');
        throw new Error(`[migrate] Failed ${filename}: ${error.message}`);
    }
}

async function runMigrations() {
    console.log(`[migrate] Using migrations dir: ${MIGRATIONS_DIR}`);

    await ensureMigrationTable();
    const applied = await getAppliedMigrations();
    const files = getMigrationFiles();

    for (const filename of files) {
        if (applied.has(filename)) {
            continue;
        }

        await applyMigration(filename);
    }

    console.log('[migrate] Schema is up to date.');
}

runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
