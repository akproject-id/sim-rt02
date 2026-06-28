const express = require('express');
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', requireAuth, (req, res) => {
    try {
        const db = getDb();

        // Total KK Aktif
        const totalKK = db.prepare(
            `SELECT COUNT(*) as count FROM kepala_keluarga WHERE status = 'AKTIF'`
        ).get();

        // Total Jiwa Aktif
        const totalJiwa = db.prepare(
            `SELECT COUNT(*) as count FROM warga WHERE status = 'AKTIF'`
        ).get();

        // Jiwa by gender
        const jiwaByGender = db.prepare(`
            SELECT jenis_kelamin, COUNT(*) as count
            FROM warga WHERE status = 'AKTIF'
            GROUP BY jenis_kelamin
        `).all();

        // Total Rumah
        const totalRumah = db.prepare('SELECT COUNT(*) as count FROM rumah').get();

        // Rumah Terisi vs Kosong
        const rumahByStatus = db.prepare(`
            SELECT status, COUNT(*) as count FROM rumah GROUP BY status
        `).all();

        // Warga Baru 30 hari terakhir
        const wargaBaru = db.prepare(`
            SELECT COUNT(*) as count FROM warga
            WHERE created_at >= datetime('now', '-30 days')
            AND status = 'AKTIF'
        `).get();

        // Data belum lengkap
        const dataNotComplete = db.prepare(`
            SELECT COUNT(*) as count FROM warga
            WHERE is_data_lengkap = 0 AND status = 'AKTIF'
        `).get();

        // Pending update requests
        const pendingUpdates = db.prepare(`
            SELECT COUNT(*) as count FROM update_request WHERE status = 'PENDING'
        `).get();

        // Warga per blok
        const wargaPerBlok = db.prepare(`
            SELECT r.blok, COUNT(w.id) as count
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE w.status = 'AKTIF'
            GROUP BY r.blok
            ORDER BY r.blok
        `).all();

        // Warga baru terakhir (5 terbaru)
        const recentWarga = db.prepare(`
            SELECT w.nama_lengkap, w.created_at, r.blok, r.nomor_rumah
            FROM warga w
            JOIN kepala_keluarga kk ON w.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE w.status = 'AKTIF'
            ORDER BY w.created_at DESC
            LIMIT 5
        `).all();

        // Status tinggal distribution
        const statusTinggal = db.prepare(`
            SELECT status_tinggal, COUNT(*) as count
            FROM warga WHERE status = 'AKTIF'
            GROUP BY status_tinggal
        `).all();

        const rumahTerisi = rumahByStatus.find(r => r.status === 'TERISI')?.count || 0;
        const rumahKosong = rumahByStatus.find(r => r.status === 'KOSONG')?.count || 0;
        const laki = jiwaByGender.find(g => g.jenis_kelamin === 'L')?.count || 0;
        const perempuan = jiwaByGender.find(g => g.jenis_kelamin === 'P')?.count || 0;

        res.json({
            totalKK: totalKK.count,
            totalJiwa: totalJiwa.count,
            jiwaLaki: laki,
            jiwaPerempuan: perempuan,
            totalRumah: totalRumah.count,
            rumahTerisi,
            rumahKosong,
            wargaBaru: wargaBaru.count,
            dataNotComplete: dataNotComplete.count,
            pendingUpdates: pendingUpdates.count,
            wargaPerBlok,
            recentWarga,
            statusTinggal
        });

    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Gagal memuat statistik dashboard.' });
    }
});

module.exports = router;
