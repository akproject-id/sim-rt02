const express = require('express');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', requireAuth, async (req, res) => {
    try {
        // Total KK Aktif
        const totalKK = await query(
            `SELECT COUNT(*) as count FROM kepala_keluarga WHERE status = 'AKTIF'`
        );

        // Total Jiwa Aktif
        const totalJiwa = await query(
            `SELECT COUNT(*) as count FROM warga WHERE status = 'AKTIF'`
        );

        // Jiwa by gender
        const jiwaByGender = await query(`
            SELECT jenis_kelamin, COUNT(*) as count
            FROM warga WHERE status = 'AKTIF'
            GROUP BY jenis_kelamin
        `);

        // Total Rumah
        const totalRumah = await query('SELECT COUNT(*) as count FROM rumah');

        // Rumah Terisi vs Kosong
        const rumahByStatus = await query(`
            SELECT status, COUNT(*) as count FROM rumah GROUP BY status
        `);

        // Warga Baru 30 hari terakhir
        const wargaBaru = await query(`
            SELECT COUNT(*) as count FROM warga
            WHERE created_at >= NOW() - INTERVAL '30 days'
            AND status = 'AKTIF'
        `);

        // Data belum lengkap
        const dataNotComplete = await query(`
            SELECT COUNT(*) as count FROM warga
            WHERE is_data_lengkap = FALSE AND status = 'AKTIF'
        `);

        // Pending update requests
        const pendingUpdates = await query(`
            SELECT COUNT(*) as count FROM update_request WHERE status = 'PENDING'
        `);

        // Warga per blok
        const wargaPerBlok = await query(`
            SELECT r.blok, COUNT(w.id) as count
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE w.status = 'AKTIF'
            GROUP BY r.blok
            ORDER BY r.blok
        `);

        // Warga baru terakhir (5 terbaru)
        const recentWarga = await query(`
            SELECT w.nama_lengkap, w.created_at, r.blok, r.nomor_rumah
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE w.status = 'AKTIF'
            ORDER BY w.created_at DESC
            LIMIT 5
        `);

        // Status tinggal distribution
        const statusTinggal = await query(`
            SELECT status_tinggal, COUNT(*) as count
            FROM warga WHERE status = 'AKTIF'
            GROUP BY status_tinggal
        `);

        const rumahTerisi = rumahByStatus.rows.find(r => r.status === 'TERISI')?.count || 0;
        const rumahKosong = rumahByStatus.rows.find(r => r.status === 'KOSONG')?.count || 0;
        const laki = jiwaByGender.rows.find(g => g.jenis_kelamin === 'L')?.count || 0;
        const perempuan = jiwaByGender.rows.find(g => g.jenis_kelamin === 'P')?.count || 0;

        res.json({
            totalKK: parseInt(totalKK.rows[0].count),
            totalJiwa: parseInt(totalJiwa.rows[0].count),
            jiwaLaki: parseInt(laki),
            jiwaPerempuan: parseInt(perempuan),
            totalRumah: parseInt(totalRumah.rows[0].count),
            rumahTerisi: parseInt(rumahTerisi),
            rumahKosong: parseInt(rumahKosong),
            wargaBaru: parseInt(wargaBaru.rows[0].count),
            dataNotComplete: parseInt(dataNotComplete.rows[0].count),
            pendingUpdates: parseInt(pendingUpdates.rows[0].count),
            wargaPerBlok: wargaPerBlok.rows,
            recentWarga: recentWarga.rows,
            statusTinggal: statusTinggal.rows
        });

    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Gagal memuat statistik dashboard.' });
    }
});

module.exports = router;
