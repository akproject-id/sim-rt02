/**
 * Smart Search Parser
 * Memecah input pencarian pengguna menjadi komponen yang bisa di-query ke database.
 *
 * Contoh input dan hasil parsing:
 * - "A12/22"       -> { type: 'address', blok: 'A12', nomor: '22' }
 * - "A12 No 22"    -> { type: 'address', blok: 'A12', nomor: '22' }
 * - "Blok A12/22"  -> { type: 'address', blok: 'A12', nomor: '22' }
 * - "a12 22"       -> { type: 'address', blok: 'A12', nomor: '22' }
 * - "3201..."      -> { type: 'nik', value: '3201...' }
 * - "08123456789"  -> { type: 'phone', value: '08123456789' }
 * - "Ahmad"        -> { type: 'name', value: 'Ahmad' }
 * - "A12"          -> { type: 'blok', value: 'A12' }
 */

function parseSearchQuery(input) {
    if (!input || typeof input !== 'string') {
        return { type: 'empty', value: '' };
    }

    const raw = input.trim();
    if (raw.length === 0) {
        return { type: 'empty', value: '' };
    }

    // 1. Cek apakah input adalah NIK (16 digit angka)
    const digitsOnly = raw.replace(/\s/g, '');
    if (/^\d{16}$/.test(digitsOnly)) {
        return { type: 'nik', value: digitsOnly };
    }

    // 2. Cek apakah input adalah No HP (10-15 digit, dimulai 0 atau 62)
    if (/^(0|62)\d{8,13}$/.test(digitsOnly)) {
        return { type: 'phone', value: digitsOnly };
    }

    // 3. Cek apakah input mengandung pattern alamat (huruf+angka)
    // Bersihkan kata-kata noise: "blok", "no", "nomor", tanda baca
    let cleaned = raw.toLowerCase();
    cleaned = cleaned.replace(/\b(blok|no|nomor|nomer|rt|rw)\b\.?/gi, '');
    cleaned = cleaned.replace(/[\/\-\.\,\:]/g, ' ');  // Ganti tanda baca dengan spasi
    cleaned = cleaned.replace(/\s+/g, ' ').trim();     // Normalisasi spasi

    const tokens = cleaned.split(' ').filter(t => t.length > 0);

    // Pattern alamat: token pertama = blok (huruf+angka), token kedua = nomor rumah (angka)
    if (tokens.length >= 1) {
        const blokPattern = /^([a-z]+\d+)$/i;  // Contoh: A12, B05
        const firstMatch = tokens[0].match(blokPattern);

        if (firstMatch) {
            const blok = firstMatch[1].toUpperCase();

            if (tokens.length >= 2) {
                // Ada nomor rumah setelah blok
                const nomor = tokens[1].replace(/^0+/, '') || tokens[1]; // Keep leading zeros for matching
                return {
                    type: 'address',
                    blok: blok,
                    nomor: tokens[1]  // Keep original format for matching
                };
            } else {
                // Hanya blok saja
                return { type: 'blok', value: blok };
            }
        }
    }

    // 4. Cek apakah input Nomor KK (16 digit)
    if (/^\d{10,16}$/.test(digitsOnly)) {
        return { type: 'nomor_kk', value: digitsOnly };
    }

    // 5. Default: pencarian berdasarkan nama
    return { type: 'name', value: raw };
}

/**
 * Build SQL query berdasarkan hasil parsing
 */
function buildSearchQuery(parsed) {
    const baseSelect = `
        SELECT
            w.id as warga_id,
            w.nik,
            w.nama_lengkap,
            w.jenis_kelamin,
            w.tempat_lahir,
            w.tanggal_lahir,
            w.pekerjaan,
            w.no_hp,
            w.hubungan_keluarga,
            w.status as warga_status,
            w.status_tinggal,
            w.is_data_lengkap,
            kk.id as kk_id,
            kk.nomor_kk,
            kk.nama_kepala,
            r.id as rumah_id,
            r.blok,
            r.nomor_rumah
        FROM warga w
        JOIN kepala_keluarga kk ON w.kk_id = kk.id
        JOIN rumah r ON kk.rumah_id = r.id
    `;

    switch (parsed.type) {
        case 'address':
            return {
                sql: baseSelect + ` WHERE UPPER(r.blok) = ? AND r.nomor_rumah = ? ORDER BY w.hubungan_keluarga`,
                params: [parsed.blok, parsed.nomor]
            };

        case 'blok':
            return {
                sql: baseSelect + ` WHERE UPPER(r.blok) = ? ORDER BY r.nomor_rumah, kk.nama_kepala`,
                params: [parsed.value]
            };

        case 'nik':
            return {
                sql: baseSelect + ` WHERE w.nik = ?`,
                params: [parsed.value]
            };

        case 'phone':
            return {
                sql: baseSelect + ` WHERE w.no_hp LIKE ?`,
                params: [`%${parsed.value}%`]
            };

        case 'nomor_kk':
            return {
                sql: baseSelect + ` WHERE kk.nomor_kk LIKE ?`,
                params: [`%${parsed.value}%`]
            };

        case 'name':
            return {
                sql: baseSelect + ` WHERE w.nama_lengkap LIKE ? ORDER BY w.nama_lengkap`,
                params: [`%${parsed.value}%`]
            };

        default:
            return {
                sql: baseSelect + ` WHERE w.status = 'AKTIF' ORDER BY r.blok, r.nomor_rumah LIMIT 50`,
                params: []
            };
    }
}

module.exports = { parseSearchQuery, buildSearchQuery };
