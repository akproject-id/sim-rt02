const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let pool;

/**
 * Create pg Pool using DATABASE_URL directly (no manual DNS resolution).
 * Supabase pooler (port 6543) requires the hostname for SNI routing.
 * Manual DNS-to-IP resolution breaks SNI and causes "connection terminated unexpectedly".
 */
function createPool() {
    if (pool) return pool;

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set!');
    }

    console.log('🔌 Creating database pool...');

    pool = new Pool({
        connectionString,
        ssl: process.env.DATABASE_SSL === 'false'
            ? false
            : { rejectUnauthorized: false },
        max: 5,
        min: 1,
        connectionTimeoutMillis: 20000,
        idleTimeoutMillis: 30000,
        query_timeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    });

    pool.on('connect', () => {
        console.log('✅ DB pool: new client connected');
    });

    pool.on('error', (err) => {
        console.error('❌ Pool idle client error:', err.message);
        // Reset pool so next query creates a fresh one
        pool = null;
    });

    return pool;
}

/**
 * Execute a query with automatic pool recovery on connection errors.
 */
async function query(text, params) {
    const MAX_RETRIES = 3;
    let lastErr;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const p = createPool();
            return await p.query(text, params);
        } catch (err) {
            lastErr = err;
            const isConnErr = err.code === 'ECONNRESET'
                || err.code === 'ECONNREFUSED'
                || err.code === 'ETIMEDOUT'
                || err.message?.includes('terminated')
                || err.message?.includes('Connection terminated')
                || err.message?.includes('connect ETIMEDOUT');

            if (isConnErr && attempt < MAX_RETRIES) {
                console.warn(`⚠️ DB query error (attempt ${attempt}/${MAX_RETRIES}): ${err.message}. Retrying...`);
                // Reset pool so a fresh connection is made
                if (pool) {
                    try { pool.end(); } catch (_) { /* ignore */ }
                    pool = null;
                }
                // Wait before retry: 500ms, 1500ms
                await new Promise(r => setTimeout(r, attempt * 500));
                continue;
            }

            throw err;
        }
    }

    throw lastErr;
}

/**
 * Get a dedicated client from the pool (for transactions).
 */
async function getClient() {
    const p = createPool();
    return p.connect();
}

/**
 * Initialize database schema from schema.sql
 */
async function initializeSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    try {
        await query(schema);
        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('❌ Schema initialization error:', err.message);
        // Re-throw so server.js knows DB is unavailable
        throw err;
    }
}

/**
 * Close all pool connections
 */
async function closeDb() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('🔒 Database connection closed');
    }
}

module.exports = { query, getClient, initializeSchema, closeDb };
