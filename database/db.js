const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'sim-rt02.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeSchema();
    }
    return db;
}

function initializeSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // better-sqlite3's exec() handles multiple statements natively
    try {
        db.exec(schema);
        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('❌ Schema initialization error:', err.message);
    }
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
        console.log('🔒 Database connection closed');
    }
}

module.exports = { getDb, closeDb };
