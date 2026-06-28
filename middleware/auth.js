/**
 * Auth Middleware - Session-based authentication for Admin
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) {
        return next();
    }

    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
    }

    return res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.role === 'ADMIN') {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden. Anda tidak memiliki akses.' });
}

module.exports = { requireAuth, requireAdmin };
