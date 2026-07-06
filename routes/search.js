const express = require('express');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { parseSearchQuery, buildSearchQuery } = require('../utils/smart-search-parser');

const router = express.Router();

// GET /api/search?q=A12/22
router.get('/', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({ data: [], parsed: { type: 'empty' }, message: 'Masukkan kata kunci pencarian.' });
        }

        const parsed = parseSearchQuery(q);
        const { sql, params } = buildSearchQuery(parsed);

        const { rows } = await query(sql, params);

        res.json({
            data: rows,
            parsed,
            total: rows.length,
            message: rows.length > 0
                ? `Ditemukan ${rows.length} hasil untuk "${q}"`
                : `Tidak ditemukan hasil untuk "${q}"`
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Gagal melakukan pencarian.' });
    }
});

module.exports = router;
