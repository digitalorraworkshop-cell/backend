const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    const secret = process.env.JWT_SECRET;

    // Debug log for every protected request
    console.log(`[AUTH-TRACE] Handling ${req.method} for ${req.originalUrl || req.url}`);

    if (!secret) {
        console.error('[AUTH-CRITICAL] JWT_SECRET is missing in environment variables!');
        return res.status(500).json({ message: 'Server configuration error' });
    }

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Extract token safely
            const authHeader = req.headers.authorization;
            token = authHeader.split(' ')[1];

            if (!token) {
                console.warn('[AUTH-TRACE] Token string missing after Bearer keyword');
                return res.status(401).json({ message: 'Not authorized, token missing' });
            }

            console.log(`[AUTH-TRACE] Verifying Token (len=${token.length}, pref=${token.substring(0, 10)}...)`);

            const decoded = jwt.verify(token, secret);
            const lookupId = decoded.id || decoded._id;
            const role = decoded.role;
            console.log(`[AUTH-TRACE] Valid Token. ID: ${lookupId}, Role from JWT: ${role}`);

            // Attach basic info from token immediately
            req.user = { _id: lookupId, id: lookupId, role: role };

            // Fetch user from DB to ensure they still exist
            const fullUser = await User.findById(lookupId).select('-password');
            if (!fullUser) {
                console.warn(`[AUTH-TRACE] User not found for ID: ${lookupId}`);
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            req.user = fullUser;

            console.log(`[AUTH-TRACE] Authenticated: ${req.user.name || req.user.id} (${req.user.role})`);
            return next();
        } catch (error) {
            console.error('[AUTH-ERROR] Token check failed:', error.name, error.message);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.warn('[AUTH-TRACE] Authorization header missing or not in Bearer format');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    console.log(`[AUTH-DEBUG] Admin middleware check for: ${req.method} ${fullUrl}`);
    console.log(`[AUTH-DEBUG] User Role: ${req.user ? req.user.role : 'NULL'}`);

    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.warn(`[AUTH-TRACE] Access denied for user: ${req.user ? (req.user.name || req.user._id) : 'Unknown'}. Role: ${req.user ? req.user.role : 'N/A'}. Target: ${req.method} ${fullUrl}`);
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};

module.exports = { protect, admin };
