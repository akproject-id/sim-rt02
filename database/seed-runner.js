require('dotenv').config();
const { seed } = require('./seed');
const { closeDb } = require('./db');

(async () => {
    try {
        await seed();
    } catch (err) {
        console.error('❌ Seed failed:', err);
    } finally {
        await closeDb();
        process.exit(0);
    }
})();
