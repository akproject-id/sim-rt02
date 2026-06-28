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
 * Update flag is_data_lengkap di database
 */
function updateCompletenessFlag(db, wargaId) {
    const warga = db.prepare('SELECT * FROM warga WHERE id = ?').get(wargaId);
    if (!warga) return false;

    const { isComplete } = checkCompleteness(warga);
    db.prepare('UPDATE warga SET is_data_lengkap = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(isComplete ? 1 : 0, wargaId);

    return isComplete;
}

/**
 * Batch update semua flag kelengkapan
 */
function updateAllCompletenessFlags(db) {
    const allWarga = db.prepare('SELECT * FROM warga WHERE status = ?').all('AKTIF');
    let complete = 0;
    let incomplete = 0;

    const updateStmt = db.prepare('UPDATE warga SET is_data_lengkap = ? WHERE id = ?');
    const transaction = db.transaction(() => {
        for (const w of allWarga) {
            const { isComplete } = checkCompleteness(w);
            updateStmt.run(isComplete ? 1 : 0, w.id);
            if (isComplete) complete++;
            else incomplete++;
        }
    });

    transaction();
    return { complete, incomplete, total: allWarga.length };
}

module.exports = {
    checkCompleteness,
    updateCompletenessFlag,
    updateAllCompletenessFlags,
    REQUIRED_FIELDS,
    RECOMMENDED_FIELDS
};
