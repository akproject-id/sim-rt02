/**
 * Clear all data except:
 * - admin table (fully preserved)
 * - rumah A17 No.22 and its related KK + warga
 */
require('dotenv').config();
const { Pool } = require('pg');
const dns = require('dns').promises;

async function createPool() {
    const dbUrl = new URL(process.env.DATABASE_URL);
    const originalHost = dbUrl.hostname;
    let resolvedHost = originalHost;
    try {
        const { address } = await dns.lookup(originalHost);
        resolvedHost = address;
    } catch {}

    return new Pool({
        host: resolvedHost,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.slice(1),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        ssl: { rejectUnauthorized: false, servername: originalHost },
        max: 3,
        connectionTimeoutMillis: 15000
    });
}

async function clearData() {
    const pool = await createPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Find rumah A17/22
        const rumahRes = await client.query(
            `SELECT id FROM rumah WHERE UPPER(blok) = 'A17' AND nomor_rumah = '22'`
        );
        const keepRumahId = rumahRes.rows.length > 0 ? rumahRes.rows[0].id : null;
        console.log(`🏠 Rumah A17/22 ID: ${keepRumahId || 'NOT FOUND'}`);

        // 2. Find KK linked to that rumah
        let keepKkIds = [];
        if (keepRumahId) {
            const kkRes = await client.query(
                `SELECT id FROM kepala_keluarga WHERE rumah_id = $1`, [keepRumahId]
            );
            keepKkIds = kkRes.rows.map(r => r.id);
        }
        console.log(`👨‍👩‍👧‍👦 KK IDs to keep: [${keepKkIds.join(', ')}]`);

        // 3. Find warga linked to those KK
        let keepWargaIds = [];
        if (keepKkIds.length > 0) {
            const wargaRes = await client.query(
                `SELECT id FROM warga WHERE kk_id = ANY($1)`, [keepKkIds]
            );
            keepWargaIds = wargaRes.rows.map(r => r.id);
        }
        console.log(`👤 Warga IDs to keep: [${keepWargaIds.join(', ')}]`);

        // 4. Delete token_link (except for kept KK)
        const tokenDel = keepKkIds.length > 0
            ? await client.query(`DELETE FROM token_link WHERE kk_id != ALL($1)`, [keepKkIds])
            : await client.query(`DELETE FROM token_link`);
        console.log(`🗑️  token_link: ${tokenDel.rowCount} deleted`);

        // 5. Delete update_request (except for kept warga)
        const updateDel = keepWargaIds.length > 0
            ? await client.query(`DELETE FROM update_request WHERE warga_id != ALL($1)`, [keepWargaIds])
            : await client.query(`DELETE FROM update_request`);
        console.log(`🗑️  update_request: ${updateDel.rowCount} deleted`);

        // 6. Delete mutasi (except for kept warga)
        const mutasiDel = keepWargaIds.length > 0
            ? await client.query(`DELETE FROM mutasi WHERE warga_id != ALL($1)`, [keepWargaIds])
            : await client.query(`DELETE FROM mutasi`);
        console.log(`🗑️  mutasi: ${mutasiDel.rowCount} deleted`);

        // 7. Delete warga (except for kept warga)
        const wargaDel = keepWargaIds.length > 0
            ? await client.query(`DELETE FROM warga WHERE id != ALL($1)`, [keepWargaIds])
            : await client.query(`DELETE FROM warga`);
        console.log(`🗑️  warga: ${wargaDel.rowCount} deleted`);

        // 8. Delete kepala_keluarga (except for kept KK)
        const kkDel = keepKkIds.length > 0
            ? await client.query(`DELETE FROM kepala_keluarga WHERE id != ALL($1)`, [keepKkIds])
            : await client.query(`DELETE FROM kepala_keluarga`);
        console.log(`🗑️  kepala_keluarga: ${kkDel.rowCount} deleted`);

        // 9. Delete rumah (except A17/22)
        const rumahDel = keepRumahId
            ? await client.query(`DELETE FROM rumah WHERE id != $1`, [keepRumahId])
            : await client.query(`DELETE FROM rumah`);
        console.log(`🗑️  rumah: ${rumahDel.rowCount} deleted`);

        await client.query('COMMIT');
        console.log('\n✅ Data cleared successfully!');
        console.log('📋 Preserved: admin table + rumah A17/22 with its KK & warga');

        // Verify remaining data
        const counts = await Promise.all([
            client.query('SELECT COUNT(*) as c FROM admin'),
            client.query('SELECT COUNT(*) as c FROM rumah'),
            client.query('SELECT COUNT(*) as c FROM kepala_keluarga'),
            client.query('SELECT COUNT(*) as c FROM warga'),
        ]);
        console.log(`\n📊 Remaining data:`);
        console.log(`   admin: ${counts[0].rows[0].c}`);
        console.log(`   rumah: ${counts[1].rows[0].c}`);
        console.log(`   kepala_keluarga: ${counts[2].rows[0].c}`);
        console.log(`   warga: ${counts[3].rows[0].c}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

clearData();
