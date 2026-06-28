require('dotenv').config();
const { seed } = require('./seed');
const { closeDb } = require('./db');

try {
    seed();
} catch (err) {
    console.error('❌ Seed failed:', err.message);
} finally {
    closeDb();
}
