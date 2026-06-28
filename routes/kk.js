const express = require('express');
const { getDb } = require('../database/db');
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
router.get('/', requireAuth, (req, res) => {
    try {
        const db = getDb();
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
            conditions.push('kk.rumah_id = ?');
            params.push(rumah_id);
        }
        if (status) {
            conditions.push('kk.status = ?');
            params.push(status);
        }
        if (blok) {
            conditions.push('UPPER(r.blok) = ?');
            params.push(blok.toUpperCase());
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' GROUP BY kk.id ORDER BY r.blok, CAST(r.nomor_rumah AS INTEGER), kk.nama_kepala';

        const rows = db.prepare(sql).all(...params);
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching KK:', err);
        res.status(500).json({ error: 'Gagal memuat data KK.' });
    }
});

// GET /api/kk/:id
router.get('/:id', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const kk = db.prepare(`
            SELECT kk.*, r.blok, r.nomor_rumah
            FROM kepala_keluarga kk
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE kk.id = ?
        `).get(req.params.id);

        if (!kk) return res.status(404).json({ error: 'KK tidak ditemukan.' });

        // Get anggota keluarga
        const anggota = db.prepare(
            `SELECT * FROM warga WHERE kk_id = ? ORDER BY
             CASE hubungan_keluarga
                WHEN 'Kepala Keluarga' THEN 1
                WHEN 'Istri' THEN 2
                WHEN 'Anak' THEN 3
                ELSE 4
             END, nama_lengkap`
        ).all(req.params.id);

        res.json({ ...kk, anggota });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat data KK.' });
    }
});

// POST /api/kk
router.post('/', requireAuth, upload.single('foto_kk'), (req, res) => {
    try {
        const db = getDb();
        const { rumah_id, nomor_kk, nama_kepala, catatan } = req.body;

        if (!rumah_id || !nama_kepala) {
            return res.status(400).json({ error: 'Rumah dan Nama Kepala Keluarga wajib diisi.' });
        }

        // Check rumah exists
        const rumah = db.prepare('SELECT * FROM rumah WHERE id = ?').get(rumah_id);
        if (!rumah) return res.status(404).json({ error: 'Rumah tidak ditemukan.' });

        // Check duplicate nomor_kk
        if (nomor_kk) {
            const dupKK = db.prepare('SELECT id FROM kepala_keluarga WHERE nomor_kk = ?').get(nomor_kk);
            if (dupKK) return res.status(409).json({ error: 'Nomor KK sudah terdaftar.' });
        }

        const foto_kk_path = req.file ? `/uploads/kk/${req.file.filename}` : null;

        const result = db.prepare(`
            INSERT INTO kepala_keluarga (rumah_id, nomor_kk, nama_kepala, status, foto_kk_path, catatan)
            VALUES (?, ?, ?, 'AKTIF', ?, ?)
        `).run(rumah_id, nomor_kk || null, nama_kepala, foto_kk_path, catatan || null);

        // Update rumah status to TERISI
        db.prepare("UPDATE rumah SET status = 'TERISI', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(rumah_id);

        res.status(201).json({
            success: true,
            message: 'KK berhasil ditambahkan.',
            id: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Error creating KK:', err);
        res.status(500).json({ error: 'Gagal menambahkan KK.' });
    }
});

// PUT /api/kk/:id
router.put('/:id', requireAuth, upload.single('foto_kk'), (req, res) => {
    try {
        const db = getDb();
        const { rumah_id, nomor_kk, nama_kepala, status, catatan } = req.body;

        const existing = db.prepare('SELECT * FROM kepala_keluarga WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'KK tidak ditemukan.' });

        // Check duplicate nomor_kk (exclude current)
        if (nomor_kk && nomor_kk !== existing.nomor_kk) {
            const dup = db.prepare('SELECT id FROM kepala_keluarga WHERE nomor_kk = ? AND id != ?')
                .get(nomor_kk, req.params.id);
            if (dup) return res.status(409).json({ error: 'Nomor KK sudah terdaftar.' });
        }

        const foto_kk_path = req.file ? `/uploads/kk/${req.file.filename}` : existing.foto_kk_path;

        db.prepare(`
            UPDATE kepala_keluarga SET
                rumah_id = COALESCE(?, rumah_id),
                nomor_kk = ?,
                nama_kepala = COALESCE(?, nama_kepala),
                status = COALESCE(?, status),
                foto_kk_path = ?,
                catatan = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            rumah_id || null,
            nomor_kk || existing.nomor_kk,
            nama_kepala || null,
            status || null,
            foto_kk_path,
            catatan !== undefined ? catatan : existing.catatan,
            req.params.id
        );

        res.json({ success: true, message: 'Data KK berhasil diperbarui.' });
    } catch (err) {
        console.error('Error updating KK:', err);
        res.status(500).json({ error: 'Gagal memperbarui data KK.' });
    }
});

module.exports = router;
