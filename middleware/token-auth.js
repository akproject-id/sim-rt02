/**
 * Token Auth Middleware - Token-based authentication for Warga self-service
 */
const { getDb } = require('../database/db');

function validateToken(req, res, next) {
    const token = req.params.token || req.body.token || req.query.token;

    if (!token) {
        return res.status(400).json({ error: 'Token tidak ditemukan.' });
    }

    const db = getDb();
    const tokenData = db.prepare(`
        SELECT tl.*, kk.nama_kepala, kk.nomor_kk, kk.rumah_id,
               r.blok, r.nomor_rumah
        FROM token_link tl
        JOIN kepala_keluarga kk ON tl.kk_id = kk.id
        JOIN rumah r ON kk.rumah_id = r.id
        WHERE tl.token = ?
    `).get(token);

    if (!tokenData) {
        return res.status(404).json({ error: 'Link tidak valid atau sudah tidak berlaku.' });
    }

    if (tokenData.is_used) {
        return res.status(410).json({ error: 'Link ini sudah pernah digunakan. Minta link baru ke Admin RT.' });
    }

    const now = new Date();
    const expired = new Date(tokenData.expired_at);
    if (now > expired) {
        return res.status(410).json({ error: 'Link sudah kedaluwarsa. Minta link baru ke Admin RT.' });
    }

    // Attach token data to request
    req.tokenData = tokenData;
    next();
}

module.exports = { validateToken };
