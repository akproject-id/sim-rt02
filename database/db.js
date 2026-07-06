const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;

let pool;

/**
 * Create pg Pool, resolving IPv6 if needed (Supabase IPv6-only host fix).
 */
async function createPool() {
    if (pool) return pool;

    const dbUrl = new URL(process.env.DATABASE_URL);
    let host = dbUrl.hostname;

    // Try to resolve the hostname — fallback to IPv6 for Supabase
    try {
        const { address } = await dns.lookup(host);
        host = address;
        console.log(`✅ DNS resolved (IPv4): ${dbUrl.hostname} → ${host}`);
    } catch {
        try {
            const addrs = await dns.resolve6(dbUrl.hostname);
            host = addrs[0];
            console.log(`✅ DNS resolved (IPv6): ${dbUrl.hostname} → ${host}`);
        } catch (e) {
            console.log(`⚠️  DNS resolve failed, using hostname as-is: ${host}`);
        }
    }

    pool = new Pool({
        host,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.slice(1),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        ssl: process.env.DATABASE_SSL === 'false'
            ? false
            : { rejectUnauthorized: false }
    });

    pool.on('error', (err) => {
        console.error('❌ Unexpected database pool error:', err);
    });

    return pool;
}

/**
 * Execute a query using the connection pool.
 * @param {string} text - SQL query with $1, $2, ... placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
async function query(text, params) {
    const p = await createPool();
    return p.query(text, params);
}

/**
 * Get a dedicated client from the pool (for transactions).
 * IMPORTANT: Always call client.release() in a finally block.
 */
async function getClient() {
    const p = await createPool();
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
