const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '../auth_debug.log');

const generateToken = (id, role) => {
    if (!id) {
        console.error('[AUTH-ERROR] Cannot generate token for null ID');
        return null;
    }
    const stringId = id.toString();
    const secret = process.env.JWT_SECRET;
    console.log(`[AUTH-TRACE] Generating token for ID: ${stringId}, Role: ${role}.`);
    return jwt.sign({ id: stringId, role }, secret, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email: loginIdentifier, password } = req.body;

    const trace = (msg) => {
        const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
        console.log(msg);
        try { fs.appendFileSync(logFile, logMsg); } catch (e) { }
    };

    trace(`[AUTH-DEBUG-V3] Login attempt for identifier: "${loginIdentifier}"`);

    if (!loginIdentifier || !password) {
        return res.status(400).json({ message: 'Email/Username and password are required' });
    }

    const identifier = loginIdentifier.toLowerCase().trim();
    trace(`[AUTH-DEBUG-V3] Normalized Identifier: "${identifier}"`);

    // Find user by either email or username
    const user = await User.findOne({
        $or: [
            { email: identifier },
            { username: identifier }
        ]
    });

    if (!user) {
        trace(`[AUTH-DEBUG-V3] User not found in DB for identifier: "${identifier}"`);
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    trace(`[AUTH-DEBUG-V3] User found: ${user.username} | Role: ${user.role} | Saved Hash Start: ${user.password?.substring(0, 10)}`);

    const isMatch = await user.matchPassword(password);
    trace(`[AUTH-DEBUG-V3] Comparison result for "${identifier}": ${isMatch}`);

    if (isMatch) {
        user.isOnline = true;
        await user.save();
        const token = generateToken(user._id, user.role);
        trace(`[AUTH-DEBUG-V3] Login SUCCESS for "${user.username}"`);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            token: token,
            profilePicture: user.profilePicture
        });
    } else {
        trace(`[AUTH-DEBUG-V3] Login Failed: Password mismatch for "${identifier}"`);
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

// @desc    Register a new user (Admin only initially or for seed)
// @route   POST /api/auth/register
// @access  Public (Should be protected or removed after initial admin creation)
const registerUser = async (req, res) => {
    const { name, email, password, role, phone, position } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400).json({ message: 'User already exists' });
        return;
    }

    const user = await User.create({
        name,
        email,
        password,
        role: role || 'employee',
        phone,
        position
    });

    if (user) {
        // Initialize Leave Balance Protocol
        await LeaveBalance.create({ user: user._id, monthlyPaidLeaveBalance: 1 });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, user.role),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

module.exports = { loginUser, registerUser };
