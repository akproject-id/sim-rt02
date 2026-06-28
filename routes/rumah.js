const express = require('express');
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/rumah - List all rumah
router.get('/', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { blok, status } = req.query;

        let sql = `
            SELECT r.*,
                COUNT(DISTINCT kk.id) as jumlah_kk,
                COUNT(DISTINCT CASE WHEN w.status = 'AKTIF' THEN w.id END) as jumlah_warga
            FROM rumah r
            LEFT JOIN kepala_keluarga kk ON kk.rumah_id = r.id AND kk.status = 'AKTIF'
            LEFT JOIN warga w ON w.kk_id = kk.id
        `;
        const params = [];
        const conditions = [];

        if (blok) {
            conditions.push('UPPER(r.blok) = ?');
            params.push(blok.toUpperCase());
        }
        if (status) {
            conditions.push('r.status = ?');
            params.push(status);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' GROUP BY r.id ORDER BY r.blok, CAST(r.nomor_rumah AS INTEGER)';

        const rows = db.prepare(sql).all(...params);

        // Get distinct blok for filter dropdown
        const blokList = db.prepare('SELECT DISTINCT blok FROM rumah ORDER BY blok').all();

        res.json({ data: rows, blokList: blokList.map(b => b.blok) });
    } catch (err) {
        console.error('Error fetching rumah:', err);
        res.status(500).json({ error: 'Gagal memuat data rumah.' });
    }
});

// GET /api/rumah/:id
router.get('/:id', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const rumah = db.prepare('SELECT * FROM rumah WHERE id = ?').get(req.params.id);
        if (!rumah) return res.status(404).json({ error: 'Rumah tidak ditemukan.' });
        res.json(rumah);
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat data rumah.' });
    }
});

// POST /api/rumah
router.post('/', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { blok, nomor_rumah, status, catatan } = req.body;

        if (!blok || !nomor_rumah) {
            return res.status(400).json({ error: 'Blok dan Nomor Rumah wajib diisi.' });
        }

        // Check duplicate
        const existing = db.prepare(
            'SELECT id FROM rumah WHERE UPPER(blok) = ? AND nomor_rumah = ?'
        ).get(blok.toUpperCase(), nomor_rumah);

        if (existing) {
            return res.status(409).json({ error: `Rumah ${blok}/${nomor_rumah} sudah terdaftar.` });
        }

        const result = db.prepare(`
            INSERT INTO rumah (blok, nomor_rumah, status, catatan)
            VALUES (?, ?, ?, ?)
        `).run(blok.toUpperCase(), nomor_rumah, status || 'KOSONG', catatan || null);

        res.status(201).json({
            success: true,
            message: `Rumah ${blok}/${nomor_rumah} berhasil ditambahkan.`,
            id: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Error creating rumah:', err);
        res.status(500).json({ error: 'Gagal menambahkan rumah.' });
    }
});

// PUT /api/rumah/:id
router.put('/:id', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { blok, nomor_rumah, status, catatan } = req.body;

        const existing = db.prepare('SELECT * FROM rumah WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Rumah tidak ditemukan.' });

        // Check duplicate (exclude current)
        if (blok && nomor_rumah) {
            const dup = db.prepare(
                'SELECT id FROM rumah WHERE UPPER(blok) = ? AND nomor_rumah = ? AND id != ?'
            ).get(blok.toUpperCase(), nomor_rumah, req.params.id);
            if (dup) {
                return res.status(409).json({ error: `Rumah ${blok}/${nomor_rumah} sudah terdaftar.` });
            }
        }

        db.prepare(`
            UPDATE rumah SET
                blok = COALESCE(?, blok),
                nomor_rumah = COALESCE(?, nomor_rumah),
                status = COALESCE(?, status),
                catatan = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            blok ? blok.toUpperCase() : null,
            nomor_rumah || null,
            status || null,
            catatan !== undefined ? catatan : existing.catatan,
            req.params.id
        );

        res.json({ success: true, message: 'Data rumah berhasil diperbarui.' });
    } catch (err) {
        console.error('Error updating rumah:', err);
        res.status(500).json({ error: 'Gagal memperbarui data rumah.' });
    }
});

// DELETE /api/rumah/:id
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const db = getDb();

        // Check if rumah has KK
        const kkCount = db.prepare(
            'SELECT COUNT(*) as count FROM kepala_keluarga WHERE rumah_id = ? AND status = ?'
        ).get(req.params.id, 'AKTIF');

        if (kkCount.count > 0) {
            return res.status(400).json({
                error: 'Rumah masih memiliki KK aktif. Pindahkan atau nonaktifkan KK terlebih dahulu.'
            });
        }

        db.prepare('DELETE FROM rumah WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Data rumah berhasil dihapus.' });
    } catch (err) {
        console.error('Error deleting rumah:', err);
        res.status(500).json({ error: 'Gagal menghapus data rumah.' });
    }
});

module.exports = router;
