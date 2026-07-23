const express = require('express');
const { query, getClient } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { updateCompletenessFlag } = require('../utils/data-completeness');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer config for KTP upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'ktp');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `ktp_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/warga - List warga with filters
router.get('/', requireAuth, async (req, res) => {
    try {
        const { kk_id, status, blok, incomplete, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = `
            SELECT w.*, kk.nomor_kk, kk.nama_kepala, r.blok, r.nomor_rumah
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
        `;
        let countSql = `
            SELECT COUNT(*) as total
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
        `;

        const params = [];
        const conditions = [];

        if (kk_id) {
            params.push(kk_id);
            conditions.push(`w.kk_id = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`w.status = $${params.length}`);
        } else {
            conditions.push("w.status = 'AKTIF'");
        }
        if (blok) {
            params.push(blok.toUpperCase());
            conditions.push(`UPPER(r.blok) = $${params.length}`);
        }
        if (incomplete === '1') {
            conditions.push('w.is_data_lengkap = FALSE');
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            sql += whereClause;
            countSql += whereClause;
        }

        // Count query uses same params (no LIMIT/OFFSET)
        const countResult = await query(countSql, params);

        // Data query with ORDER BY + LIMIT/OFFSET
        const dataParams = [...params];
        dataParams.push(parseInt(limit));
        dataParams.push(offset);

        sql += ` ORDER BY r.blok,
            CASE WHEN r.nomor_rumah ~ '^[0-9]+$' THEN CAST(r.nomor_rumah AS INTEGER) ELSE 999999 END,
            r.nomor_rumah, kk.nama_kepala,
                  CASE w.hubungan_keluarga
                     WHEN 'Kepala Keluarga' THEN 1
                     WHEN 'Istri' THEN 2
                     WHEN 'Anak' THEN 3
                     ELSE 4
                  END
                 LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

        const result = await query(sql, dataParams);

        res.json({
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching warga:', err);
        res.status(500).json({ error: 'Gagal memuat data warga.' });
    }
});

// GET /api/warga/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { rows: wargaRows } = await query(`
            SELECT w.*, kk.nomor_kk, kk.nama_kepala, r.blok, r.nomor_rumah, r.id as rumah_id
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE w.id = $1
        `, [req.params.id]);

        const warga = wargaRows[0];
        if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan.' });

        // Get mutasi history
        const { rows: mutasi } = await query(
            'SELECT * FROM mutasi WHERE warga_id = $1 ORDER BY tanggal_mutasi DESC',
            [req.params.id]
        );

        res.json({ ...warga, mutasi });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat data warga.' });
    }
});

// POST /api/warga
router.post('/', requireAuth, upload.single('foto_ktp'), async (req, res) => {
    try {
        const {
            kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
            jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
            pekerjaan, no_hp, hubungan_keluarga, status_tinggal
        } = req.body;

        if (!kk_id || !nama_lengkap) {
            return res.status(400).json({ error: 'KK dan Nama Lengkap wajib diisi.' });
        }

        // Check KK exists
        const { rows: kkRows } = await query('SELECT * FROM kepala_keluarga WHERE id = $1', [kk_id]);
        if (!kkRows[0]) return res.status(404).json({ error: 'KK tidak ditemukan.' });

        // Check duplicate NIK
        if (nik) {
            const { rows: dupRows } = await query('SELECT id FROM warga WHERE nik = $1', [nik]);
            if (dupRows.length > 0) return res.status(409).json({ error: 'NIK sudah terdaftar.' });
        }

        const foto_ktp_path = req.file ? `/uploads/ktp/${req.file.filename}` : null;

        const { rows } = await query(`
            INSERT INTO warga (
                kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
                jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
                pekerjaan, no_hp, hubungan_keluarga, foto_ktp_path,
                status, status_tinggal, is_data_lengkap
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'AKTIF', $14, FALSE)
            RETURNING id
        `, [
            kk_id, nik || null, nama_lengkap, tempat_lahir || null,
            tanggal_lahir || null, jenis_kelamin || null, agama || null,
            status_perkawinan || null, pendidikan_terakhir || null,
            pekerjaan || null, no_hp || null, hubungan_keluarga || null,
            foto_ktp_path, status_tinggal || 'TETAP'
        ]);

        const wargaId = rows[0].id;

        // Update completeness flag
        await updateCompletenessFlag(query, wargaId);

        // Create MASUK mutasi
        await query(`
            INSERT INTO mutasi (warga_id, jenis_mutasi, tanggal_mutasi, keterangan, diinput_oleh)
            VALUES ($1, 'MASUK', CURRENT_DATE, 'Warga baru ditambahkan', $2)
        `, [wargaId, req.session.adminName || 'Admin']);

        res.status(201).json({
            success: true,
            message: `Warga ${nama_lengkap} berhasil ditambahkan.`,
            id: wargaId
        });
    } catch (err) {
        console.error('Error creating warga:', err);
        res.status(500).json({ error: 'Gagal menambahkan warga.' });
    }
});

// PUT /api/warga/:id
router.put('/:id', requireAuth, upload.single('foto_ktp'), async (req, res) => {
    try {
        const { rows: existingRows } = await query('SELECT * FROM warga WHERE id = $1', [req.params.id]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Warga tidak ditemukan.' });

        const {
            kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
            jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
            pekerjaan, no_hp, hubungan_keluarga, status_tinggal
        } = req.body;

        // Check duplicate NIK (exclude current)
        if (nik && nik !== existing.nik) {
            const { rows: dupRows } = await query(
                'SELECT id FROM warga WHERE nik = $1 AND id != $2',
                [nik, req.params.id]
            );
            if (dupRows.length > 0) return res.status(409).json({ error: 'NIK sudah terdaftar.' });
        }

        const foto_ktp_path = req.file ? `/uploads/ktp/${req.file.filename}` : existing.foto_ktp_path;

        await query(`
            UPDATE warga SET
                kk_id = COALESCE($1, kk_id),
                nik = $2,
                nama_lengkap = COALESCE($3, nama_lengkap),
                tempat_lahir = $4,
                tanggal_lahir = $5,
                jenis_kelamin = $6,
                agama = $7,
                status_perkawinan = $8,
                pendidikan_terakhir = $9,
                pekerjaan = $10,
                no_hp = $11,
                hubungan_keluarga = $12,
                foto_ktp_path = $13,
                status_tinggal = COALESCE($14, status_tinggal),
                updated_at = NOW()
            WHERE id = $15
        `, [
            kk_id || null,
            nik !== undefined ? nik : existing.nik,
            nama_lengkap || null,
            tempat_lahir !== undefined ? tempat_lahir : existing.tempat_lahir,
            tanggal_lahir !== undefined ? tanggal_lahir : existing.tanggal_lahir,
            jenis_kelamin !== undefined ? jenis_kelamin : existing.jenis_kelamin,
            agama !== undefined ? agama : existing.agama,
            status_perkawinan !== undefined ? status_perkawinan : existing.status_perkawinan,
            pendidikan_terakhir !== undefined ? pendidikan_terakhir : existing.pendidikan_terakhir,
            pekerjaan !== undefined ? pekerjaan : existing.pekerjaan,
            no_hp !== undefined ? no_hp : existing.no_hp,
            hubungan_keluarga !== undefined ? hubungan_keluarga : existing.hubungan_keluarga,
            foto_ktp_path,
            status_tinggal || null,
            req.params.id
        ]);

        // Update completeness flag
        await updateCompletenessFlag(query, req.params.id);

        res.json({ success: true, message: 'Data warga berhasil diperbarui.' });
    } catch (err) {
        console.error('Error updating warga:', err);
        res.status(500).json({ error: 'Gagal memperbarui data warga.' });
    }
});

// POST /api/warga/:id/mutasi - Mutasi warga (soft delete)
router.post('/:id/mutasi', requireAuth, async (req, res) => {
    try {
        const { jenis_mutasi, tanggal_mutasi, keterangan } = req.body;

        if (!jenis_mutasi || !tanggal_mutasi) {
            return res.status(400).json({ error: 'Jenis mutasi dan tanggal wajib diisi.' });
        }

        const { rows: wargaRows } = await query(`
            SELECT w.*, kk.id as kk_id, kk.rumah_id
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            WHERE w.id = $1
        `, [req.params.id]);

        const warga = wargaRows[0];
        if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan.' });

        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Insert mutasi record
            await client.query(`
                INSERT INTO mutasi (warga_id, jenis_mutasi, tanggal_mutasi, keterangan, diinput_oleh)
                VALUES ($1, $2, $3, $4, $5)
            `, [req.params.id, jenis_mutasi, tanggal_mutasi, keterangan || null, req.session.adminName || 'Admin']);

            // 2. Set warga status to TIDAK_AKTIF (soft delete)
            await client.query(
                `UPDATE warga SET status = 'TIDAK_AKTIF', updated_at = NOW() WHERE id = $1`,
                [req.params.id]
            );

            // 3. Check if all members of KK are inactive
            const { rows: activeRows } = await client.query(
                "SELECT COUNT(*) as count FROM warga WHERE kk_id = $1 AND status = 'AKTIF'",
                [warga.kk_id]
            );

            if (parseInt(activeRows[0].count) === 0) {
                await client.query(
                    "UPDATE kepala_keluarga SET status = 'TIDAK_AKTIF', updated_at = NOW() WHERE id = $1",
                    [warga.kk_id]
                );

                // 4. Check if all KK in the rumah are inactive
                const { rows: activeKKRows } = await client.query(
                    "SELECT COUNT(*) as count FROM kepala_keluarga WHERE rumah_id = $1 AND status = 'AKTIF'",
                    [warga.rumah_id]
                );

                if (parseInt(activeKKRows[0].count) === 0) {
                    await client.query(
                        "UPDATE rumah SET status = 'KOSONG', updated_at = NOW() WHERE id = $1",
                        [warga.rumah_id]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            message: `Mutasi ${jenis_mutasi} untuk ${warga.nama_lengkap} berhasil dicatat.`
        });
    } catch (err) {
        console.error('Error processing mutasi:', err);
        res.status(500).json({ error: 'Gagal memproses mutasi.' });
    }
});

// GET /api/warga/:id/mutasi - Get mutasi history
router.get('/:id/mutasi', requireAuth, async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM mutasi WHERE warga_id = $1 ORDER BY tanggal_mutasi DESC, created_at DESC',
            [req.params.id]
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat riwayat mutasi.' });
    }
});

module.exports = router;
