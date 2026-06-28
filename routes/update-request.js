const express = require('express');
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { validateToken } = require('../middleware/token-auth');
const { updateCompletenessFlag } = require('../utils/data-completeness');

const router = express.Router();

// POST /api/update-request/submit/:token - Warga submits update via token
router.post('/submit/:token', validateToken, (req, res) => {
    try {
        const db = getDb();
        const tokenData = req.tokenData;
        const { updates } = req.body;

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diupdate.' });
        }

        const transaction = db.transaction(() => {
            for (const update of updates) {
                const { warga_id, data_baru } = update;

                // Verify warga belongs to this KK
                const warga = db.prepare(
                    'SELECT * FROM warga WHERE id = ? AND kk_id = ? AND status = ?'
                ).get(warga_id, tokenData.kk_id, 'AKTIF');

                if (!warga) continue;

                // Build data_lama snapshot
                const data_lama = {
                    nik: warga.nik,
                    nama_lengkap: warga.nama_lengkap,
                    tempat_lahir: warga.tempat_lahir,
                    tanggal_lahir: warga.tanggal_lahir,
                    jenis_kelamin: warga.jenis_kelamin,
                    agama: warga.agama,
                    status_perkawinan: warga.status_perkawinan,
                    pendidikan_terakhir: warga.pendidikan_terakhir,
                    pekerjaan: warga.pekerjaan,
                    no_hp: warga.no_hp,
                    hubungan_keluarga: warga.hubungan_keluarga,
                    status_tinggal: warga.status_tinggal
                };

                // Check if there are actual changes
                const hasChanges = Object.keys(data_baru).some(
                    key => data_lama[key] !== data_baru[key]
                );

                if (hasChanges) {
                    db.prepare(`
                        INSERT INTO update_request (warga_id, data_lama, data_baru, status)
                        VALUES (?, ?, ?, 'PENDING')
                    `).run(warga_id, JSON.stringify(data_lama), JSON.stringify(data_baru));
                }
            }

            // Mark token as used
            db.prepare('UPDATE token_link SET is_used = 1 WHERE token = ?')
                .run(tokenData.token);
        });

        transaction();

        res.json({
            success: true,
            message: 'Data berhasil dikirim! Menunggu persetujuan Admin RT.'
        });
    } catch (err) {
        console.error('Error submitting update:', err);
        res.status(500).json({ error: 'Gagal mengirim update data.' });
    }
});

// GET /api/update-request - List all update requests (admin)
router.get('/', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { status } = req.query;

        let sql = `
            SELECT ur.*, w.nama_lengkap, w.nik,
                   kk.nama_kepala, kk.nomor_kk,
                   r.blok, r.nomor_rumah,
                   a.nama_lengkap as reviewer_name
            FROM update_request ur
            JOIN warga w ON ur.warga_id = w.id
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            LEFT JOIN admin a ON ur.reviewed_by = a.id
        `;

        const params = [];
        if (status) {
            sql += ' WHERE ur.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY ur.created_at DESC';

        const rows = db.prepare(sql).all(...params);

        // Parse JSON fields
        const data = rows.map(r => ({
            ...r,
            data_lama: JSON.parse(r.data_lama),
            data_baru: JSON.parse(r.data_baru)
        }));

        res.json({ data });
    } catch (err) {
        console.error('Error fetching update requests:', err);
        res.status(500).json({ error: 'Gagal memuat daftar pengajuan update.' });
    }
});

// GET /api/update-request/:id
router.get('/:id', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const request = db.prepare(`
            SELECT ur.*, w.nama_lengkap, w.nik,
                   kk.nama_kepala, kk.nomor_kk,
                   r.blok, r.nomor_rumah
            FROM update_request ur
            JOIN warga w ON ur.warga_id = w.id
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE ur.id = ?
        `).get(req.params.id);

        if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

        res.json({
            ...request,
            data_lama: JSON.parse(request.data_lama),
            data_baru: JSON.parse(request.data_baru)
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal memuat detail pengajuan.' });
    }
});

// PUT /api/update-request/:id/approve
router.put('/:id/approve', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { catatan_admin } = req.body;

        const request = db.prepare('SELECT * FROM update_request WHERE id = ? AND status = ?')
            .get(req.params.id, 'PENDING');

        if (!request) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan atau sudah diproses.' });
        }

        const dataBaru = JSON.parse(request.data_baru);

        const transaction = db.transaction(() => {
            // Apply changes to warga table
            const updateFields = Object.keys(dataBaru)
                .map(key => `${key} = ?`)
                .join(', ');
            const updateValues = Object.values(dataBaru);

            db.prepare(`
                UPDATE warga SET ${updateFields}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(...updateValues, request.warga_id);

            // Update completeness flag
            updateCompletenessFlag(db, request.warga_id);

            // Update request status
            db.prepare(`
                UPDATE update_request SET
                    status = 'APPROVED',
                    catatan_admin = ?,
                    reviewed_by = ?,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(catatan_admin || null, req.session.adminId, req.params.id);
        });

        transaction();

        res.json({ success: true, message: 'Update data telah disetujui.' });
    } catch (err) {
        console.error('Error approving update:', err);
        res.status(500).json({ error: 'Gagal menyetujui update.' });
    }
});

// PUT /api/update-request/:id/reject
router.put('/:id/reject', requireAuth, (req, res) => {
    try {
        const db = getDb();
        const { catatan_admin } = req.body;

        if (!catatan_admin) {
            return res.status(400).json({ error: 'Alasan penolakan wajib diisi.' });
        }

        const request = db.prepare('SELECT * FROM update_request WHERE id = ? AND status = ?')
            .get(req.params.id, 'PENDING');

        if (!request) {
            return res.status(404).json({ error: 'Pengajuan tidak ditemukan atau sudah diproses.' });
        }

        db.prepare(`
            UPDATE update_request SET
                status = 'REJECTED',
                catatan_admin = ?,
                reviewed_by = ?,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(catatan_admin, req.session.adminId, req.params.id);

        res.json({ success: true, message: 'Update data telah ditolak.' });
    } catch (err) {
        console.error('Error rejecting update:', err);
        res.status(500).json({ error: 'Gagal menolak update.' });
    }
});

module.exports = router;
