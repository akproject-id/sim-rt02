const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);

    if (!admin) {
        return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const validPassword = bcrypt.compareSync(password, admin.password_hash);
    if (!validPassword) {
        return res.status(401).json({ error: 'Username atau password salah.' });
    }

    // Set session
    req.session.adminId = admin.id;
    req.session.adminName = admin.nama_lengkap;
    req.session.role = admin.role;

    res.json({
        success: true,
        message: 'Login berhasil!',
        admin: {
            id: admin.id,
            username: admin.username,
            nama_lengkap: admin.nama_lengkap,
            role: admin.role
        }
    });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Gagal logout.' });
        }
        res.json({ success: true, message: 'Logout berhasil.' });
    });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    if (req.session && req.session.adminId) {
        return res.json({
            authenticated: true,
            admin: {
                id: req.session.adminId,
                nama_lengkap: req.session.adminName,
                role: req.session.role
            }
        });
    }
    res.json({ authenticated: false });
});

module.exports = router;
