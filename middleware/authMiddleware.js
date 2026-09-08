const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'User not found' });
            }

            next();
        } catch (error) {
            console.error('[AUTH-MIDDLEWARE-ERROR]', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};

const isManager = (req, res, next) => {
    const roles = ['admin', 'seo-manager', 'assets-manager', 'manager'];
    if (req.user && roles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Manager access required' });
    }
};

const isAssetsManager = (req, res, next) => {
    const allowedRoles = ['admin', 'assets-manager', 'manager', 'seo-manager'];
    if (req.user && allowedRoles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Assets Manager access required' });
    }
};

module.exports = { protect, admin, isManager, isAssetsManager };
