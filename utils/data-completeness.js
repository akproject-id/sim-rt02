/**
 * Data Completeness Checker
 * Memeriksa apakah data warga sudah lengkap
 */

const REQUIRED_FIELDS = [
    'nik',
    'nama_lengkap',
    'tempat_lahir',
    'tanggal_lahir',
    'jenis_kelamin',
    'agama',
    'status_perkawinan',
    'hubungan_keluarga'
];

const RECOMMENDED_FIELDS = [
    'pekerjaan',
    'pendidikan_terakhir',
    'no_hp'
];

function checkCompleteness(wargaData) {
    const missingRequired = [];
    const missingRecommended = [];

    for (const field of REQUIRED_FIELDS) {
        if (!wargaData[field] || wargaData[field].toString().trim() === '') {
            missingRequired.push(field);
        }
    }

    for (const field of RECOMMENDED_FIELDS) {
        if (!wargaData[field] || wargaData[field].toString().trim() === '') {
            missingRecommended.push(field);
        }
    }

    const isComplete = missingRequired.length === 0;

    return {
        isComplete,
        missingRequired,
        missingRecommended,
        completenessPercent: Math.round(
            ((REQUIRED_FIELDS.length - missingRequired.length) / REQUIRED_FIELDS.length) * 100
        )
    };
}

/**
 * Update flag is_data_lengkap di database.
 * @param {Function} queryFn - async function(text, params) that executes a query (pool.query or client.query)
 * @param {number} wargaId
 * @returns {Promise<boolean>}
 */
async function updateCompletenessFlag(queryFn, wargaId) {
    const { rows } = await queryFn('SELECT * FROM warga WHERE id = $1', [wargaId]);
    const warga = rows[0];
    if (!warga) return false;

    const { isComplete } = checkCompleteness(warga);
    await queryFn(
        'UPDATE warga SET is_data_lengkap = $1, updated_at = NOW() WHERE id = $2',
        [isComplete, wargaId]
    );

    return isComplete;
}

/**
 * Batch update semua flag kelengkapan
 */
async function updateAllCompletenessFlags() {
    const { query, getClient } = require('../database/db');

    const { rows: allWarga } = await query("SELECT * FROM warga WHERE status = 'AKTIF'");
    let complete = 0;
    let incomplete = 0;

    const client = await getClient();
    try {
        await client.query('BEGIN');
        for (const w of allWarga) {
            const { isComplete } = checkCompleteness(w);
            await client.query(
                'UPDATE warga SET is_data_lengkap = $1 WHERE id = $2',
                [isComplete, w.id]
            );
            if (isComplete) complete++;
            else incomplete++;
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return { complete, incomplete, total: allWarga.length };
}

module.exports = {
    checkCompleteness,
    updateCompletenessFlag,
    updateAllCompletenessFlags,
    REQUIRED_FIELDS,
    RECOMMENDED_FIELDS
};
