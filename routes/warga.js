const express = require('express');
const { getDb } = require('../database/db');
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
router.get('/', requireAuth, (req, res) => {
    try {
        const db = getDb();
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
            conditions.push('w.kk_id = ?');
            params.push(kk_id);
        }
        if (status) {
            conditions.push('w.status = ?');
            params.push(status);
        } else {
            conditions.push("w.status = 'AKTIF'");
        }
        if (blok) {
            conditions.push('UPPER(r.blok) = ?');
            params.push(blok.toUpperCase());
        }
        if (incomplete === '1') {
            conditions.push('w.is_data_lengkap = 0');
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            sql += whereClause;
            countSql += whereClause;
        }

        sql += ` ORDER BY r.blok, CAST(r.nomor_rumah AS INTEGER), kk.nama_kepala,
                 CASE w.hubungan_keluarga
                    WHEN 'Kepala Keluarga' THEN 1
                    WHEN 'Istri' THEN 2
                    WHEN 'Anak' THEN 3
                    ELSE 4
                 END
                 LIMIT ? OFFSET ?`;

        const totalResult = db.prepare(countSql).get(...params);
        const rows = db.prepare(sql).all(...params, parseInt(limit), offset);

        res.json({
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult.total,
                totalPages: Math.ceil(totalResult.total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching warga:', err);
        res.status(500).json({ error: 'Gagal memuat data warga.' });
    }
});

// GET /api/warga/:id
router.get('/:id', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const warga = db.prepare(`
            SELECT w.*, kk.nomor_kk, kk.nama_kepala, r.blok, r.nomor_rumah, r.id as rumah_id
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE w.id = ?
        `).get(req.params.id);

        if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan.' });

        // Get mutasi history
        const mutasi = db.prepare(
            'SELECT * FROM mutasi WHERE warga_id = ? ORDER BY tanggal_mutasi DESC'
        ).all(req.params.id);

        res.json({ ...warga, mutasi });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat data warga.' });
    }
});

// POST /api/warga
router.post('/', requireAuth, upload.single('foto_ktp'), (req, res) => {
    try {
        const db = getDb();
        const {
            kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
            jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
            pekerjaan, no_hp, hubungan_keluarga, status_tinggal
        } = req.body;

        if (!kk_id || !nama_lengkap) {
            return res.status(400).json({ error: 'KK dan Nama Lengkap wajib diisi.' });
        }

        // Check KK exists
        const kk = db.prepare('SELECT * FROM kepala_keluarga WHERE id = ?').get(kk_id);
        if (!kk) return res.status(404).json({ error: 'KK tidak ditemukan.' });

        // Check duplicate NIK
        if (nik) {
            const dupNIK = db.prepare('SELECT id FROM warga WHERE nik = ?').get(nik);
            if (dupNIK) return res.status(409).json({ error: 'NIK sudah terdaftar.' });
        }

        const foto_ktp_path = req.file ? `/uploads/ktp/${req.file.filename}` : null;

        const result = db.prepare(`
            INSERT INTO warga (
                kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
                jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
                pekerjaan, no_hp, hubungan_keluarga, foto_ktp_path,
                status, status_tinggal, is_data_lengkap
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?, 0)
        `).run(
            kk_id, nik || null, nama_lengkap, tempat_lahir || null,
            tanggal_lahir || null, jenis_kelamin || null, agama || null,
            status_perkawinan || null, pendidikan_terakhir || null,
            pekerjaan || null, no_hp || null, hubungan_keluarga || null,
            foto_ktp_path, status_tinggal || 'TETAP'
        );

        const wargaId = result.lastInsertRowid;

        // Update completeness flag
        updateCompletenessFlag(db, wargaId);

        // Create MASUK mutasi
        db.prepare(`
            INSERT INTO mutasi (warga_id, jenis_mutasi, tanggal_mutasi, keterangan, diinput_oleh)
            VALUES (?, 'MASUK', date('now'), 'Warga baru ditambahkan', ?)
        `).run(wargaId, req.session.adminName || 'Admin');

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
router.put('/:id', requireAuth, upload.single('foto_ktp'), (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM warga WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Warga tidak ditemukan.' });

        const {
            kk_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir,
            jenis_kelamin, agama, status_perkawinan, pendidikan_terakhir,
            pekerjaan, no_hp, hubungan_keluarga, status_tinggal
        } = req.body;

        // Check duplicate NIK (exclude current)
        if (nik && nik !== existing.nik) {
            const dup = db.prepare('SELECT id FROM warga WHERE nik = ? AND id != ?')
                .get(nik, req.params.id);
            if (dup) return res.status(409).json({ error: 'NIK sudah terdaftar.' });
        }

        const foto_ktp_path = req.file ? `/uploads/ktp/${req.file.filename}` : existing.foto_ktp_path;

        db.prepare(`
            UPDATE warga SET
                kk_id = COALESCE(?, kk_id),
                nik = ?,
                nama_lengkap = COALESCE(?, nama_lengkap),
                tempat_lahir = ?,
                tanggal_lahir = ?,
                jenis_kelamin = ?,
                agama = ?,
                status_perkawinan = ?,
                pendidikan_terakhir = ?,
                pekerjaan = ?,
                no_hp = ?,
                hubungan_keluarga = ?,
                foto_ktp_path = ?,
                status_tinggal = COALESCE(?, status_tinggal),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
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
        );

        // Update completeness flag
        updateCompletenessFlag(db, req.params.id);

        res.json({ success: true, message: 'Data warga berhasil diperbarui.' });
    } catch (err) {
        console.error('Error updating warga:', err);
        res.status(500).json({ error: 'Gagal memperbarui data warga.' });
    }
});

// POST /api/warga/:id/mutasi - Mutasi warga (soft delete)
router.post('/:id/mutasi', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { jenis_mutasi, tanggal_mutasi, keterangan } = req.body;

        if (!jenis_mutasi || !tanggal_mutasi) {
            return res.status(400).json({ error: 'Jenis mutasi dan tanggal wajib diisi.' });
        }

        const warga = db.prepare(`
            SELECT w.*, kk.id as kk_id, kk.rumah_id
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            WHERE w.id = ?
        `).get(req.params.id);

        if (!warga) return res.status(404).json({ error: 'Warga tidak ditemukan.' });

        const transaction = db.transaction(() => {
            // 1. Insert mutasi record
            db.prepare(`
                INSERT INTO mutasi (warga_id, jenis_mutasi, tanggal_mutasi, keterangan, diinput_oleh)
                VALUES (?, ?, ?, ?, ?)
            `).run(req.params.id, jenis_mutasi, tanggal_mutasi, keterangan || null, req.session.adminName || 'Admin');

            // 2. Set warga status to TIDAK_AKTIF (soft delete)
            db.prepare(`
                UPDATE warga SET status = 'TIDAK_AKTIF', updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(req.params.id);

            // 3. Check if all members of KK are inactive
            const activeMembers = db.prepare(
                "SELECT COUNT(*) as count FROM warga WHERE kk_id = ? AND status = 'AKTIF'"
            ).get(warga.kk_id);

            if (activeMembers.count === 0) {
                db.prepare(
                    "UPDATE kepala_keluarga SET status = 'TIDAK_AKTIF', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
                ).run(warga.kk_id);

                // 4. Check if all KK in the rumah are inactive
                const activeKK = db.prepare(
                    "SELECT COUNT(*) as count FROM kepala_keluarga WHERE rumah_id = ? AND status = 'AKTIF'"
                ).get(warga.rumah_id);

                if (activeKK.count === 0) {
                    db.prepare(
                        "UPDATE rumah SET status = 'KOSONG', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
                    ).run(warga.rumah_id);
                }
            }
        });

        transaction();

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
router.get('/:id/mutasi', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const mutasi = db.prepare(
            'SELECT * FROM mutasi WHERE warga_id = ? ORDER BY tanggal_mutasi DESC, created_at DESC'
        ).all(req.params.id);
        res.json({ data: mutasi });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat riwayat mutasi.' });
    }
});

module.exports = router;
