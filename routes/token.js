const express = require('express');
const crypto = require('crypto');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { validateToken } = require('../middleware/token-auth');

const router = express.Router();

// POST /api/token/generate - Admin generates token link
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const { kk_id } = req.body;

        if (!kk_id) {
            return res.status(400).json({ error: 'KK ID wajib diisi.' });
        }

        const { rows: kkRows } = await query(`
            SELECT kk.*, r.blok, r.nomor_rumah
            FROM kepala_keluarga kk
            JOIN rumah r ON kk.rumah_id = r.id
            WHERE kk.id = $1 AND kk.status = 'AKTIF'
        `, [kk_id]);

        const kk = kkRows[0];
        if (!kk) return res.status(404).json({ error: 'KK tidak ditemukan atau tidak aktif.' });

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiry
        const expiryHours = parseInt(process.env.TOKEN_EXPIRY_HOURS) || 72;
        const expiredAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

        await query(`
            INSERT INTO token_link (kk_id, token, expired_at, is_used, generated_by)
            VALUES ($1, $2, $3, FALSE, $4)
        `, [kk_id, token, expiredAt, req.session.adminId]);

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const updateUrl = `${baseUrl}/update/${token}`;

        res.status(201).json({
            success: true,
            message: `Link update berhasil dibuat untuk KK ${kk.nama_kepala}.`,
            data: {
                token,
                url: updateUrl,
                expired_at: expiredAt,
                kk_nama: kk.nama_kepala,
                alamat: `${kk.blok}/${kk.nomor_rumah}`,
                // Pre-formatted WhatsApp message
                wa_message: `Assalamu'alaikum Bpk/Ibu ${kk.nama_kepala},\n\nBerikut link untuk memperbarui data kependudukan keluarga Anda di RT.02:\n\n${updateUrl}\n\n⚠️ Link berlaku ${expiryHours} jam dan hanya bisa digunakan 1x.\n\nTerima kasih.\n- Pengurus RT.02`
            }
        });
    } catch (err) {
        console.error('Error generating token:', err);
        res.status(500).json({ error: 'Gagal membuat link update.' });
    }
});

// GET /api/token/validate/:token - Validate token and return KK data
router.get('/validate/:token', validateToken, async (req, res) => {
    try {
        const tokenData = req.tokenData;

        // Get all family members
        const { rows: anggota } = await query(`
            SELECT w.id, w.nik, w.nama_lengkap, w.tempat_lahir, w.tanggal_lahir,
                   w.jenis_kelamin, w.agama, w.status_perkawinan, w.pendidikan_terakhir,
                   w.pekerjaan, w.no_hp, w.hubungan_keluarga, w.status_tinggal
            FROM warga w
            WHERE w.kk_id = $1 AND w.status = 'AKTIF'
            ORDER BY CASE w.hubungan_keluarga
                WHEN 'Kepala Keluarga' THEN 1
                WHEN 'Istri' THEN 2
                WHEN 'Anak' THEN 3
                ELSE 4
            END
        `, [tokenData.kk_id]);

        res.json({
            valid: true,
            kk: {
                nama_kepala: tokenData.nama_kepala,
                nomor_kk: tokenData.nomor_kk,
                blok: tokenData.blok,
                nomor_rumah: tokenData.nomor_rumah
            },
            anggota,
            expired_at: tokenData.expired_at
        });
    } catch (err) {
        console.error('Error validating token:', err);
        res.status(500).json({ error: 'Gagal memvalidasi token.' });
    }
});

// GET /api/token/list - List all tokens (admin)
router.get('/list', requireAuth, async (req, res) => {
    try {
        const { rows: tokens } = await query(`
            SELECT tl.*, kk.nama_kepala, kk.nomor_kk, r.blok, r.nomor_rumah,
                   a.nama_lengkap as generated_by_name
            FROM token_link tl
            JOIN kepala_keluarga kk ON tl.kk_id = kk.id
            JOIN rumah r ON kk.rumah_id = r.id
            JOIN admin a ON tl.generated_by = a.id
            ORDER BY tl.created_at DESC
            LIMIT 50
        `);

        // Add status info
        const now = new Date();
        const enrichedTokens = tokens.map(t => ({
            ...t,
            is_expired: new Date(t.expired_at) < now,
            is_active: !t.is_used && new Date(t.expired_at) >= now,
            url: `${process.env.BASE_URL || 'http://localhost:3000'}/update/${t.token}`
        }));

        res.json({ data: enrichedTokens });
    } catch (err) {
        console.error('Error fetching tokens:', err);
        res.status(500).json({ error: 'Gagal memuat daftar token.' });
    }
});

module.exports = router;
