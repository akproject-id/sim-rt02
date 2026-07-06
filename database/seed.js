const bcrypt = require('bcryptjs');
const { query, getClient } = require('./db');

async function seed() {
    // Check if already seeded
    const { rows } = await query('SELECT COUNT(*) as count FROM admin');
    if (parseInt(rows[0].count) > 0) {
        console.log('⚠️  Database already seeded. Skipping.');
        return;
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // ============ ADMIN ============
        const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        await client.query(
            `INSERT INTO admin (username, password_hash, nama_lengkap, role) VALUES ($1, $2, $3, $4)`,
            ['admin', passwordHash, 'Sekretaris RT.02', 'ADMIN']
        );

        // ============ RUMAH ============
        const rumahData = [
            // Blok A12
            ['A12', '01', 'TERISI'], ['A12', '02', 'TERISI'], ['A12', '03', 'KOSONG'],
            ['A12', '04', 'TERISI'], ['A12', '05', 'TERISI'], ['A12', '06', 'TERISI'],
            ['A12', '07', 'KOSONG'], ['A12', '08', 'TERISI'], ['A12', '09', 'TERISI'],
            ['A12', '10', 'TERISI'],
            // Blok A17
            ['A17', '01', 'TERISI'], ['A17', '02', 'TERISI'], ['A17', '03', 'TERISI'],
            ['A17', '04', 'KOSONG'], ['A17', '05', 'TERISI'],
            // Blok B05
            ['B05', '01', 'TERISI'], ['B05', '02', 'TERISI'], ['B05', '03', 'KOSONG'],
            ['B05', '04', 'TERISI'], ['B05', '05', 'TERISI'],
        ];

        for (const [blok, nomor, status] of rumahData) {
            await client.query(
                'INSERT INTO rumah (blok, nomor_rumah, status) VALUES ($1, $2, $3)',
                [blok, nomor, status]
            );
        }

        // ============ KEPALA KELUARGA ============
        const kkData = [
            [1, '3201010101080001', 'Ahmad Sudrajat', 'AKTIF'],
            [2, '3201010101080002', 'Budi Santoso', 'AKTIF'],
            [4, '3201010101080003', 'Cecep Hidayat', 'AKTIF'],
            [5, '3201010101080004', 'Dedi Kurniawan', 'AKTIF'],
            [6, '3201010101080005', 'Eko Prasetyo', 'AKTIF'],
            [8, '3201010101080006', 'Fajar Nugroho', 'AKTIF'],
            [9, '3201010101080007', 'Gunawan Wibisono', 'AKTIF'],
            [10, '3201010101080008', 'Hendra Wijaya', 'AKTIF'],
            [11, '3201010101080009', 'Irfan Hakim', 'AKTIF'],
            [12, '3201010101080010', 'Joko Widodo', 'AKTIF'],
            [13, '3201010101080011', 'Kardi Slamet', 'AKTIF'],
            [15, '3201010101080012', 'Lukman Harun', 'AKTIF'],
            [16, '3201010101080013', 'Muhammad Rizki', 'AKTIF'],
            [17, '3201010101080014', 'Nandang Supriatna', 'AKTIF'],
            [19, '3201010101080015', 'Oscar Permana', 'AKTIF'],
            [20, '3201010101080016', 'Purnomo Adi', 'AKTIF'],
        ];

        for (const [rumah_id, nomor_kk, nama_kepala, status] of kkData) {
            await client.query(
                'INSERT INTO kepala_keluarga (rumah_id, nomor_kk, nama_kepala, status) VALUES ($1, $2, $3, $4)',
                [rumah_id, nomor_kk, nama_kepala, status]
            );
        }

        // ============ WARGA ============
        const wargaData = [
            // KK 1 - Ahmad Sudrajat (A12/01)
            [1, '3201010101800001', 'Ahmad Sudrajat', 'Bandung', '1980-05-15', 'L', 'Islam', 'Kawin', 'S1', 'PNS', '081234567001', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [1, '3201010101820002', 'Siti Nurhaliza', 'Bandung', '1982-08-20', 'P', 'Islam', 'Kawin', 'S1', 'Guru', '081234567002', 'Istri', 'AKTIF', 'TETAP', true],
            [1, '3201010101050003', 'Rina Sudrajat', 'Bandung', '2005-03-10', 'P', 'Islam', 'Belum Kawin', 'SMA', 'Pelajar', null, 'Anak', 'AKTIF', 'TETAP', false],
            [1, '3201010101100004', 'Dimas Sudrajat', 'Bandung', '2010-11-25', 'L', 'Islam', 'Belum Kawin', 'SMP', 'Pelajar', null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 2 - Budi Santoso (A12/02)
            [2, '3201010101780005', 'Budi Santoso', 'Jakarta', '1978-01-12', 'L', 'Islam', 'Kawin', 'S2', 'Dosen', '081234567003', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [2, '3201010101800006', 'Dewi Lestari', 'Jakarta', '1980-06-30', 'P', 'Islam', 'Kawin', 'S1', 'Dokter', '081234567004', 'Istri', 'AKTIF', 'TETAP', true],
            [2, '3201010101080007', 'Rizki Santoso', 'Bandung', '2008-09-14', 'L', 'Islam', 'Belum Kawin', 'SMP', 'Pelajar', null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 3 - Cecep Hidayat (A12/04)
            [3, '3201010101750008', 'Cecep Hidayat', 'Garut', '1975-12-01', 'L', 'Islam', 'Kawin', 'SMA', 'Wiraswasta', '081234567005', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [3, '3201010101780009', 'Neng Komariah', 'Garut', '1978-04-18', 'P', 'Islam', 'Kawin', 'SMA', 'Ibu Rumah Tangga', '081234567006', 'Istri', 'AKTIF', 'TETAP', true],
            [3, '3201010101000010', 'Asep Hidayat', 'Bandung', '2000-07-22', 'L', 'Islam', 'Belum Kawin', 'S1', 'Karyawan Swasta', '081234567007', 'Anak', 'AKTIF', 'TETAP', true],
            [3, '3201010101030011', 'Tuti Hidayat', 'Bandung', '2003-02-14', 'P', 'Islam', 'Belum Kawin', 'SMA', 'Mahasiswa', null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 4 - Dedi Kurniawan (A12/05)
            [4, '3201010101850012', 'Dedi Kurniawan', 'Cirebon', '1985-09-03', 'L', 'Islam', 'Kawin', 'D3', 'Teknisi', '081234567008', 'Kepala Keluarga', 'AKTIF', 'KONTRAK', true],
            [4, '3201010101880013', 'Yuni Kurniawan', 'Cirebon', '1988-12-17', 'P', 'Islam', 'Kawin', 'SMA', 'Ibu Rumah Tangga', '081234567009', 'Istri', 'AKTIF', 'KONTRAK', true],
            [4, '3201010101150014', 'Aldi Kurniawan', 'Bandung', '2015-04-08', 'L', 'Islam', 'Belum Kawin', 'SD', 'Pelajar', null, 'Anak', 'AKTIF', 'KONTRAK', false],

            // KK 5 - Eko Prasetyo (A12/06)
            [5, '3201010101900015', 'Eko Prasetyo', 'Semarang', '1990-03-25', 'L', 'Kristen', 'Kawin', 'S1', 'Programmer', '081234567010', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [5, '3201010101920016', 'Maria Prasetyo', 'Semarang', '1992-07-11', 'P', 'Kristen', 'Kawin', 'S1', 'Desainer', '081234567011', 'Istri', 'AKTIF', 'TETAP', true],

            // KK 6 - Fajar Nugroho (A12/08)
            [6, '3201010101820017', 'Fajar Nugroho', 'Surabaya', '1982-11-05', 'L', 'Islam', 'Kawin', 'S1', 'Manager', '081234567012', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [6, '3201010101850018', 'Ani Nugroho', 'Surabaya', '1985-02-28', 'P', 'Islam', 'Kawin', 'D3', 'Apoteker', '081234567013', 'Istri', 'AKTIF', 'TETAP', true],
            [6, '3201010101120019', 'Bayu Nugroho', 'Bandung', '2012-06-15', 'L', 'Islam', 'Belum Kawin', 'SD', 'Pelajar', null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 7 - Gunawan Wibisono (A12/09)
            [7, '3201010101700020', 'Gunawan Wibisono', 'Yogyakarta', '1970-08-19', 'L', 'Islam', 'Kawin', 'S2', 'Pensiunan', '081234567014', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [7, '3201010101730021', 'Sri Wibisono', 'Yogyakarta', '1973-01-30', 'P', 'Islam', 'Kawin', 'S1', 'Ibu Rumah Tangga', null, 'Istri', 'AKTIF', 'TETAP', false],

            // KK 8 - Hendra Wijaya (A12/10)
            [8, '3201010101880022', 'Hendra Wijaya', 'Medan', '1988-05-07', 'L', 'Buddha', 'Kawin', 'S1', 'Pengusaha', '081234567015', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [8, '3201010101900023', 'Linda Wijaya', 'Medan', '1990-09-12', 'P', 'Buddha', 'Kawin', 'S1', 'Akuntan', '081234567016', 'Istri', 'AKTIF', 'TETAP', true],
            [8, '3201010101180024', 'Kevin Wijaya', 'Bandung', '2018-03-20', 'L', 'Buddha', 'Belum Kawin', null, null, null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 9 - Irfan Hakim (A17/01)
            [9, '3201010101830025', 'Irfan Hakim', 'Bogor', '1983-04-14', 'L', 'Islam', 'Kawin', 'S1', 'Polisi', '081234567017', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [9, '3201010101860026', 'Ratna Hakim', 'Bogor', '1986-10-05', 'P', 'Islam', 'Kawin', 'D3', 'Bidan', '081234567018', 'Istri', 'AKTIF', 'TETAP', true],
            [9, '3201010101130027', 'Farel Hakim', 'Bandung', '2013-08-30', 'L', 'Islam', 'Belum Kawin', 'SD', 'Pelajar', null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 10 - Joko Widodo (A17/02)
            [10, '3201010101760028', 'Joko Widodo', 'Solo', '1976-06-21', 'L', 'Islam', 'Kawin', 'S1', 'TNI', '081234567019', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],

            // KK 11 - Kardi Slamet (A17/03)
            [11, '3201010101680029', 'Kardi Slamet', 'Tasikmalaya', '1968-02-10', 'L', 'Islam', 'Kawin', 'SMP', 'Pedagang', '081234567020', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [11, '3201010101700030', 'Enok Slamet', 'Tasikmalaya', '1970-05-15', 'P', 'Islam', 'Kawin', 'SD', 'Pedagang', null, 'Istri', 'AKTIF', 'TETAP', false],

            // KK 12 - Lukman Harun (A17/05)
            [12, '3201010101950031', 'Lukman Harun', 'Bandung', '1995-11-08', 'L', 'Islam', 'Kawin', 'S1', 'Karyawan Swasta', '081234567021', 'Kepala Keluarga', 'AKTIF', 'KONTRAK', true],
            [12, '3201010101970032', 'Fitri Harun', 'Bandung', '1997-03-22', 'P', 'Islam', 'Kawin', 'S1', 'Karyawan Swasta', '081234567022', 'Istri', 'AKTIF', 'KONTRAK', true],

            // KK 13 - Muhammad Rizki (B05/01)
            [13, '3201010101870033', 'Muhammad Rizki', 'Depok', '1987-07-16', 'L', 'Islam', 'Kawin', 'S2', 'Dosen', '081234567023', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [13, '3201010101900034', 'Nurul Rizki', 'Depok', '1990-01-04', 'P', 'Islam', 'Kawin', 'S1', 'Guru', '081234567024', 'Istri', 'AKTIF', 'TETAP', true],
            [13, '3201010101160035', 'Alya Rizki', 'Bandung', '2016-09-28', 'P', 'Islam', 'Belum Kawin', 'SD', 'Pelajar', null, 'Anak', 'AKTIF', 'TETAP', false],
            [13, '3201010101200036', 'Zaki Rizki', 'Bandung', '2020-12-12', 'L', 'Islam', 'Belum Kawin', null, null, null, 'Anak', 'AKTIF', 'TETAP', false],

            // KK 14 - Nandang Supriatna (B05/02)
            [14, '3201010101720037', 'Nandang Supriatna', 'Sumedang', '1972-04-03', 'L', 'Islam', 'Kawin', 'SMA', 'Sopir', '081234567025', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],

            // KK 15 - Oscar Permana (B05/04)
            [15, '3201010101930038', 'Oscar Permana', 'Bandung', '1993-06-17', 'L', 'Katolik', 'Belum Kawin', 'S1', 'Freelancer', '081234567026', 'Kepala Keluarga', 'AKTIF', 'KOST', true],

            // KK 16 - Purnomo Adi (B05/05)
            [16, '3201010101800039', 'Purnomo Adi', 'Malang', '1980-10-29', 'L', 'Hindu', 'Kawin', 'S1', 'Arsitek', '081234567027', 'Kepala Keluarga', 'AKTIF', 'TETAP', true],
            [16, '3201010101830040', 'Ketut Adi', 'Malang', '1983-08-14', 'P', 'Hindu', 'Kawin', 'D3', 'Perawat', '081234567028', 'Istri', 'AKTIF', 'TETAP', true],
        ];

        for (const w of wargaData) {
            await client.query(
                `INSERT INTO warga (
                    kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
                    jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
                    pekerjaan, no_hp, hubungan_keluarga, status, status_tinggal, is_data_lengkap
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                w
            );
        }

        // ============ MUTASI SAMPLE ============
        // Sample: Semua warga masuk
        for (let i = 1; i <= 40; i++) {
            await client.query(
                `INSERT INTO mutasi (warga_id, jenis_mutasi, tanggal_mutasi, keterangan, diinput_oleh)
                 VALUES ($1, $2, $3, $4, $5)`,
                [i, 'MASUK', '2026-01-15', 'Data awal pendataan warga RT.02', 'Sekretaris RT.02']
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    console.log('🌱 Database seeded successfully!');
    console.log('   - 1 Admin');
    console.log('   - 20 Rumah (3 blok)');
    console.log('   - 16 Kepala Keluarga');
    console.log('   - 40 Warga');
}

module.exports = { seed };
