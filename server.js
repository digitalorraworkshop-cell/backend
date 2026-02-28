const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const LeaveBalance = require('./models/LeaveBalance');

// Production-ready Monthly Credit Logic
const creditMonthlyLeaves = async () => {
    try {
        const today = new Date();
        if (today.getDate() === 1) {
            const balances = await LeaveBalance.find({});
            for (let b of balances) {
                b.carryForwardLeave += b.monthlyPaidLeaveBalance;
                b.monthlyPaidLeaveBalance = 1;
                b.shortLeaveUsedThisMonth = 0;
                await b.save();
            }
            console.log('[LEAVE-ENGINE] Monthly credits processed successfully.');
        }
    } catch (err) {
        console.error('[LEAVE-ENGINE-ERROR]', err);
    }
};
creditMonthlyLeaves();

const app = express();
const http = require('http');
const server = http.createServer(app);
const { initSocket, broadcastStatus } = require('./socket');
const PORT = 5001;
console.log(`[SERVER-START] Environment Check: PORT=${process.env.PORT}, Forcing=${PORT}`);
console.log(`[SERVER-START] NODE_ENV=${process.env.NODE_ENV}`);

// Initialize Socket.io
initSocket(server);

// Ensure "Company Team" group
const { ensureCompanyGroup } = require('./controllers/chatController');
ensureCompanyGroup();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5174',
        'http://127.0.0.1:5174'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[SERVER-TRACE] ${req.method} ${req.originalUrl}`);
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const connectDB = require('./config/db');

// Database Connection
connectDB().then(async () => {
    // Startup cleanup: Clear any stale session state from previous server run
    try {
        await User.updateMany(
            { currentSessionId: { $ne: null } },
            { $set: { currentSessionId: null, isOnline: false, currentStatus: 'Offline' } }
        );
        console.log('[STARTUP] Stale session cleanup complete.');

        // Birthday Diagnostic
        const dobCount = await User.countDocuments({ dateOfBirth: { $exists: true, $ne: null }, isActive: true });
        console.log(`[STARTUP] Birthday System: ${dobCount} active employees have DOB set.`);
    } catch (err) {
        console.error('[STARTUP-CLEANUP-ERROR]', err);
    }
});

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const screenshotRoutes = require('./routes/screenshotRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const taskRoutes = require('./routes/taskRoutes');
const activityRoutes = require('./routes/activityRoutes');
const chatRoutes = require('./routes/chatRoutes');
const dailyUpdateRoutes = require('./routes/dailyUpdateRoutes');
const birthdayRoutes = require('./routes/birthdayRoutes');


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/screenshots', screenshotRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/daily-updates', dailyUpdateRoutes);
app.use('/api/daily_updates', dailyUpdateRoutes); // Alias for reliability
app.use('/api/birthdays', birthdayRoutes);


app.get('/', (req, res) => {
    res.send('API is running...');
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Global Error Handler Middleware
app.use((err, req, res, next) => {
    console.error('[GLOBAL-ERROR]', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'production' ? null : err.message
    });
});

process.on('unhandledRejection', (err) => {
    console.error('[FATAL] Unhandled Rejection:', err);
});

// Enterprise Presence Monitor: Runs every 30 seconds
setInterval(async () => {
    try {
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

        // 1. Mark Idle: Online but no heartbeat for 2 minutes
        const idleUsers = await User.find({
            currentStatus: 'Online',
            lastActiveAt: { $lt: twoMinsAgo }
        });

        for (const user of idleUsers) {
            user.currentStatus = 'Idle';
            await user.save();
            broadcastStatus(user._id, 'Idle');
            console.log(`[MONITOR] ${user.name} is now Idle (No heartbeat for 2m)`);
        }

        // 2. Cleanup Offline: Persistent inactive users
        // Give Working users (Checked-in) a 15-minute grace period without pulses before marking Offline
        const ghostUsers = await User.find({
            currentStatus: { $in: ['Online', 'Idle', 'Working', 'On Break'] },
            lastActiveAt: { $lt: fifteenMinsAgo }
        });

        for (const user of ghostUsers) {
            user.currentStatus = 'Offline';
            user.isOnline = false;
            await user.save();
            broadcastStatus(user._id, 'Offline');
            console.log(`[MONITOR] ${user.name} marked Offline (No pulse for 15m)`);
        }
    } catch (err) {
        console.error('[MONITOR-ERROR]', err);
    }
}, 30000);
