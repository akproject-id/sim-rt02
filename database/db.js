const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;

let pool;

/**
 * Create pg Pool with IPv6-fallback DNS resolution and SNI preservation.
 */
async function createPool() {
    if (pool) return pool;

    const dbUrl = new URL(process.env.DATABASE_URL);
    const originalHost = dbUrl.hostname;
    let resolvedHost = originalHost;

    // Resolve hostname to IP (handles IPv6-only hosts)
    try {
        const { address } = await dns.lookup(originalHost);
        resolvedHost = address;
        console.log(`✅ DNS resolved (IPv4): ${originalHost} → ${resolvedHost}`);
    } catch {
        try {
            const addrs = await dns.resolve6(originalHost);
            resolvedHost = addrs[0];
            console.log(`✅ DNS resolved (IPv6): ${originalHost} → ${resolvedHost}`);
        } catch (e) {
            console.log(`⚠️ DNS resolve failed, using hostname: ${originalHost}`);
        }
    }

    pool = new Pool({
        host: resolvedHost,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.slice(1),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        ssl: process.env.DATABASE_SSL === 'false'
            ? false
            : {
                rejectUnauthorized: false,
                servername: originalHost   // Preserve SNI for Supabase routing
            },
        max: 3,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 20000,
        keepAlive: true,
        allowExitOnIdle: true
    });

    pool.on('error', (err) => {
        console.error('❌ Pool error:', err.message);
    });

    return pool;
}

/**
 * Execute a query using the connection pool.
 */
async function query(text, params) {
    const p = await createPool();
    return p.query(text, params);
}

/**
 * Get a dedicated client from the pool (for transactions).
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
