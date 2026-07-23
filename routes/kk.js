const express = require('express');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer config for KK photo upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'kk');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `kk_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/kk - List all KK
router.get('/', requireAuth, async (req, res) => {
    try {
        const { rumah_id, status, blok } = req.query;

        let sql = `
            SELECT kk.*, r.blok, r.nomor_rumah,
                COUNT(DISTINCT CASE WHEN w.status = 'AKTIF' THEN w.id END) as jumlah_anggota
            FROM kepala_keluarga kk
            JOIN rumah r ON kk.rumah_id = r.id
            LEFT JOIN warga w ON w.kk_id = kk.id
        `;
        const params = [];
        const conditions = [];

        if (rumah_id) {
            params.push(rumah_id);
            conditions.push(`kk.rumah_id = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`kk.status = $${params.length}`);
        }
        if (blok) {
            params.push(blok.toUpperCase());
            conditions.push(`UPPER(r.blok) = $${params.length}`);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ` GROUP BY kk.id, r.blok, r.nomor_rumah ORDER BY r.blok,
            CASE WHEN r.nomor_rumah ~ '^[0-9]+$' THEN CAST(r.nomor_rumah AS INTEGER) ELSE 999999 END,
            r.nomor_rumah, kk.nama_kepala`;

        const result = await query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching KK:', err);
        res.status(500).json({ error: 'Gagal memuat data KK.' });
    }
});

// GET /api/kk/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { rows: kkRows } = await query(`
            SELECT kk.*, r.blok, r.nomor_rumah
            FROM kepala_keluarga kk
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE kk.id = $1
        `, [req.params.id]);

        const kk = kkRows[0];
        if (!kk) return res.status(404).json({ error: 'KK tidak ditemukan.' });

        // Get anggota keluarga
        const { rows: anggota } = await query(
            `SELECT * FROM warga WHERE kk_id = $1 ORDER BY
             CASE hubungan_keluarga
                WHEN 'Kepala Keluarga' THEN 1
                WHEN 'Istri' THEN 2
                WHEN 'Anak' THEN 3
                ELSE 4
             END, nama_lengkap`,
            [req.params.id]
        );

        res.json({ ...kk, anggota });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat data KK.' });
    }
});

// POST /api/kk
router.post('/', requireAuth, upload.single('foto_kk'), async (req, res) => {
    try {
        const { rumah_id, nomor_kk, nama_kepala, catatan } = req.body;

        if (!rumah_id || !nama_kepala) {
            return res.status(400).json({ error: 'Rumah dan Nama Kepala Keluarga wajib diisi.' });
        }

        // Check rumah exists
        const { rows: rumahRows } = await query('SELECT * FROM rumah WHERE id = $1', [rumah_id]);
        if (!rumahRows[0]) return res.status(404).json({ error: 'Rumah tidak ditemukan.' });

        // Check duplicate nomor_kk
        if (nomor_kk) {
            const { rows: dupRows } = await query('SELECT id FROM kepala_keluarga WHERE nomor_kk = $1', [nomor_kk]);
            if (dupRows.length > 0) return res.status(409).json({ error: 'Nomor KK sudah terdaftar.' });
        }

        const foto_kk_path = req.file ? `/uploads/kk/${req.file.filename}` : null;

        const { rows } = await query(`
            INSERT INTO kepala_keluarga (rumah_id, nomor_kk, nama_kepala, status, foto_kk_path, catatan)
            VALUES ($1, $2, $3, 'AKTIF', $4, $5) RETURNING id
        `, [rumah_id, nomor_kk || null, nama_kepala, foto_kk_path, catatan || null]);

        // Update rumah status to TERISI
        await query(
            "UPDATE rumah SET status = 'TERISI', updated_at = NOW() WHERE id = $1",
            [rumah_id]
        );

        res.status(201).json({
            success: true,
            message: 'KK berhasil ditambahkan.',
            id: rows[0].id
        });
    } catch (err) {
        console.error('Error creating KK:', err);
        res.status(500).json({ error: 'Gagal menambahkan KK.' });
    }
});

// PUT /api/kk/:id
router.put('/:id', requireAuth, upload.single('foto_kk'), async (req, res) => {
    try {
        const { rumah_id, nomor_kk, nama_kepala, status, catatan } = req.body;

        const { rows: existingRows } = await query('SELECT * FROM kepala_keluarga WHERE id = $1', [req.params.id]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'KK tidak ditemukan.' });

        // Check duplicate nomor_kk (exclude current)
        if (nomor_kk && nomor_kk !== existing.nomor_kk) {
            const { rows: dupRows } = await query(
                'SELECT id FROM kepala_keluarga WHERE nomor_kk = $1 AND id != $2',
                [nomor_kk, req.params.id]
            );
            if (dupRows.length > 0) return res.status(409).json({ error: 'Nomor KK sudah terdaftar.' });
        }

        const foto_kk_path = req.file ? `/uploads/kk/${req.file.filename}` : existing.foto_kk_path;

        await query(`
            UPDATE kepala_keluarga SET
                rumah_id = COALESCE($1, rumah_id),
                nomor_kk = $2,
                nama_kepala = COALESCE($3, nama_kepala),
                status = COALESCE($4, status),
                foto_kk_path = $5,
                catatan = $6,
                updated_at = NOW()
            WHERE id = $7
        `, [
            rumah_id || null,
            nomor_kk || existing.nomor_kk,
            nama_kepala || null,
            status || null,
            foto_kk_path,
            catatan !== undefined ? catatan : existing.catatan,
            req.params.id
        ]);

        res.json({ success: true, message: 'Data KK berhasil diperbarui.' });
    } catch (err) {
        console.error('Error updating KK:', err);
        res.status(500).json({ error: 'Gagal memperbarui data KK.' });
    }
});

module.exports = router;
