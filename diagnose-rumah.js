require('dotenv').config();
const { query } = require('./database/db');

async function diagnose() {
    try {
        // Count total
        const total = await query('SELECT COUNT(*) as c FROM rumah');
        console.log(`📊 Total rumah: ${total.rows[0].c}`);

        // Check for non-numeric nomor_rumah
        const nonNumeric = await query(`
            SELECT id, blok, nomor_rumah 
            FROM rumah 
            WHERE nomor_rumah !~ '^[0-9]+$'
            LIMIT 20
        `);
        console.log(`\n⚠️  Non-numeric nomor_rumah: ${nonNumeric.rows.length}`);
        if (nonNumeric.rows.length > 0) {
            nonNumeric.rows.forEach(r => console.log(`   - id=${r.id} blok=${r.blok} nomor=${r.nomor_rumah}`));
        }

        // Sample data
        const sample = await query('SELECT id, blok, nomor_rumah, status FROM rumah LIMIT 10');
        console.log('\n📋 Sample data:');
        sample.rows.forEach(r => console.log(`   ${r.blok}/${r.nomor_rumah} (status: ${r.status})`));

        // Test the actual query that fails
        console.log('\n🧪 Testing list query...');
        try {
            const result = await query(`
                SELECT r.*,
                    COUNT(DISTINCT kk.id) as jumlah_kk,
                    COUNT(DISTINCT CASE WHEN w.status = 'AKTIF' THEN w.id END) as jumlah_warga
                FROM rumah r
                LEFT JOIN kepala_keluarga kk ON kk.rumah_id = r.id AND kk.status = 'AKTIF'
                LEFT JOIN warga w ON w.kk_id = kk.id
                GROUP BY r.id ORDER BY r.blok, CAST(r.nomor_rumah AS INTEGER)
            `);
            console.log(`✅ Query OK: ${result.rows.length} rows`);
        } catch (err) {
            console.log(`❌ Query FAILED: ${err.message}`);
        }

        // Test with safe sort
        console.log('\n🧪 Testing with safe sort...');
        try {
            const result2 = await query(`
                SELECT r.*,
                    COUNT(DISTINCT kk.id) as jumlah_kk,
                    COUNT(DISTINCT CASE WHEN w.status = 'AKTIF' THEN w.id END) as jumlah_warga
                FROM rumah r
                LEFT JOIN kepala_keluarga kk ON kk.rumah_id = r.id AND kk.status = 'AKTIF'
                LEFT JOIN warga w ON w.kk_id = kk.id
                GROUP BY r.id 
                ORDER BY r.blok, 
                    CASE WHEN r.nomor_rumah ~ '^[0-9]+$' 
                         THEN CAST(r.nomor_rumah AS INTEGER) 
                         ELSE 999999 END,
                    r.nomor_rumah
            `);
            console.log(`✅ Safe query OK: ${result2.rows.length} rows`);
        } catch (err) {
            console.log(`❌ Safe query FAILED: ${err.message}`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

diagnose();
