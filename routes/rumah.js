const express = require('express');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/rumah - List all rumah
router.get('/', requireAuth, async (req, res) => {
    try {
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
            params.push(blok.toUpperCase());
            conditions.push(`UPPER(r.blok) = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`r.status = $${params.length}`);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ` GROUP BY r.id ORDER BY r.blok, 
            CASE WHEN r.nomor_rumah ~ '^[0-9]+$' 
                 THEN CAST(r.nomor_rumah AS INTEGER) 
                 ELSE 999999 END, 
            r.nomor_rumah`;

        const result = await query(sql, params);

        // Get distinct blok for filter dropdown
        const blokResult = await query('SELECT DISTINCT blok FROM rumah ORDER BY blok');

        res.json({ data: result.rows, blokList: blokResult.rows.map(b => b.blok) });
    } catch (err) {
        console.error('Error fetching rumah:', err);
        res.status(500).json({ error: 'Gagal memuat data rumah.' });
    }
});

// GET /api/rumah/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM rumah WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Rumah tidak ditemukan.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat data rumah.' });
    }
});

// POST /api/rumah
router.post('/', requireAuth, async (req, res) => {
    try {
        const { blok, nomor_rumah, status, catatan } = req.body;

        if (!blok || !nomor_rumah) {
            return res.status(400).json({ error: 'Blok dan Nomor Rumah wajib diisi.' });
        }

        // Check duplicate
        const { rows: existing } = await query(
            'SELECT id FROM rumah WHERE UPPER(blok) = $1 AND nomor_rumah = $2',
            [blok.toUpperCase(), nomor_rumah]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: `Rumah ${blok}/${nomor_rumah} sudah terdaftar.` });
        }

        const { rows } = await query(`
            INSERT INTO rumah (blok, nomor_rumah, status, catatan)
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [blok.toUpperCase(), nomor_rumah, status || 'KOSONG', catatan || null]);

        res.status(201).json({
            success: true,
            message: `Rumah ${blok}/${nomor_rumah} berhasil ditambahkan.`,
            id: rows[0].id
        });
    } catch (err) {
        console.error('Error creating rumah:', err);
        res.status(500).json({ error: 'Gagal menambahkan rumah.' });
    }
});

// PUT /api/rumah/:id
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { blok, nomor_rumah, status, catatan } = req.body;

        const { rows: existingRows } = await query('SELECT * FROM rumah WHERE id = $1', [req.params.id]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Rumah tidak ditemukan.' });

        // Check duplicate (exclude current)
        if (blok && nomor_rumah) {
            const { rows: dupRows } = await query(
                'SELECT id FROM rumah WHERE UPPER(blok) = $1 AND nomor_rumah = $2 AND id != $3',
                [blok.toUpperCase(), nomor_rumah, req.params.id]
            );
            if (dupRows.length > 0) {
                return res.status(409).json({ error: `Rumah ${blok}/${nomor_rumah} sudah terdaftar.` });
            }
        }

        await query(`
            UPDATE rumah SET
                blok = COALESCE($1, blok),
                nomor_rumah = COALESCE($2, nomor_rumah),
                status = COALESCE($3, status),
                catatan = $4,
                updated_at = NOW()
            WHERE id = $5
        `, [
            blok ? blok.toUpperCase() : null,
            nomor_rumah || null,
            status || null,
            catatan !== undefined ? catatan : existing.catatan,
            req.params.id
        ]);

        res.json({ success: true, message: 'Data rumah berhasil diperbarui.' });
    } catch (err) {
        console.error('Error updating rumah:', err);
        res.status(500).json({ error: 'Gagal memperbarui data rumah.' });
    }
});

// DELETE /api/rumah/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        // Check if rumah has KK
        const { rows: kkRows } = await query(
            "SELECT COUNT(*) as count FROM kepala_keluarga WHERE rumah_id = $1 AND status = 'AKTIF'",
            [req.params.id]
        );

        if (parseInt(kkRows[0].count) > 0) {
            return res.status(400).json({
                error: 'Rumah masih memiliki KK aktif. Pindahkan atau nonaktifkan KK terlebih dahulu.'
            });
        }

        await query('DELETE FROM rumah WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Data rumah berhasil dihapus.' });
    } catch (err) {
        console.error('Error deleting rumah:', err);
        res.status(500).json({ error: 'Gagal menghapus data rumah.' });
    }
});

module.exports = router;
