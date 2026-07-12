require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeSchema, closeDb } = require('./database/db');
const { seed } = require('./database/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Railway, Render, etc. use reverse proxy)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ============ MIDDLEWARE ============
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'sim-rt02-fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : false
    },
    proxy: process.env.NODE_ENV === 'production' // Trust first proxy
}));

// Make session data available to all responses
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// ============ ROUTES ============
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const rumahRoutes = require('./routes/rumah');
const kkRoutes = require('./routes/kk');
const wargaRoutes = require('./routes/warga');
const searchRoutes = require('./routes/search');
const tokenRoutes = require('./routes/token');
const updateRequestRoutes = require('./routes/update-request');
const exportRoutes = require('./routes/export');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rumah', rumahRoutes);
app.use('/api/kk', kkRoutes);
app.use('/api/warga', wargaRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/update-request', updateRequestRoutes);
app.use('/api/export', exportRoutes);

// ============ PAGE ROUTES ============
const { requireAuth } = require('./middleware/auth');

// Login page
app.get('/login', (req, res) => {
    if (req.session && req.session.adminId) {
        return res.redirect('/admin/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin pages (protected)
app.get('/admin/*', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin', requireAuth, (req, res) => {
    res.redirect('/admin/dashboard');
});

// Warga update page (token-based)
app.get('/update/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'warga-update.html'));
});

// Root redirect
app.get('/', (req, res) => {
    if (req.session && req.session.adminId) {
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/login');
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server. Silakan coba lagi.' });
});

// ============ INITIALIZE DATABASE & START SERVER ============
async function startServer() {
    try {
        await initializeSchema();
        await seed();
        console.log('✅ Database ready');
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════╗
║     SIM-RT.02 - Sistem Informasi Warga      ║
║     Fase 1: MVP                              ║
╠══════════════════════════════════════════════╣
║  🌐 Server: http://localhost:${PORT}            ║
║  👤 Admin : admin / admin123                 ║
║  📁 DB    : Supabase PostgreSQL              ║
╚══════════════════════════════════════════════╝
        `);
    });
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    await closeDb();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDb();
    process.exit(0);
});
