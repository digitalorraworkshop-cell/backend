const ActivityLog = require('../models/ActivityLog');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { broadcastStatus } = require('../socket');
const { formatMinutesToHHMM } = require('../utils/timeUtils');

// @desc    Update user status and handle session start/stop
// @route   POST /api/activity/status
// @access  Private
const updateStatus = async (req, res) => {
    try {
        const { status, activeWindowTitle, url, keystrokesCount, mouseClicks, idleTime, activeTime } = req.body;
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Handle Session ID
        let sessionId = user.currentSessionId;
        if (status !== 'Offline' && !sessionId) {
            sessionId = require('crypto').randomBytes(8).toString('hex');
        }

        // 1. Log Activity
        await ActivityLog.create({
            user: userId,
            status,
            sessionId: sessionId || 'AUTO',
            date: today,
            startTime: new Date(),
            activeWindowTitle,
            url,
            keystrokesCount: keystrokesCount || 0,
            mouseClicks: mouseClicks || 0,
            idleTime: idleTime || 0,
            activeTime: activeTime || 0
        });

        // 2. Ensure Attendance Record exists for the day
        if (status !== 'Offline') {
            await Attendance.findOneAndUpdate(
                { user: userId, date: today },
                { $setOnInsert: { checkInTime: new Date(), status: 'Working' }, $set: { sessionId } },
                { upsert: true, new: true }
            );
        }

        // 3. Admin Notification
        broadcastStatus(userId, status);

        // 4. Update User Model
        user.currentStatus = status;
        user.currentSessionId = (status === 'Offline') ? null : sessionId;
        user.lastActiveAt = new Date();
        await user.save();

        res.json({ success: true, status, sessionId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Handle Heartbeat (10s interval) - Increment Minutes
// @route   POST /api/activity/heartbeat
// @access  Private
const handleHeartbeat = async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');

        const incValue = 10 / 60; // 10 seconds in minutes
        const incObject = {};

        if (['Active', 'Working'].includes(status)) {
            incObject.activeMinutes = incValue;
            incObject.totalMinutes = incValue;
        } else if (['Idle', 'Tab Inactive', 'Idle Warning'].includes(status)) {
            incObject.idleMinutes = incValue;
            incObject.totalMinutes = incValue;
        } else if (['Lunch', 'Meeting', 'On Break'].includes(status)) {
            incObject.breakMinutes = incValue;
        }

        // Atomic increment to avoid race conditions
        const attendance = await Attendance.findOneAndUpdate(
            { user: userId, date: today },
            { $inc: incObject },
            { new: true }
        );

        if (attendance) {
            // Update formatted string once per heartbeat
            attendance.formattedTotalHours = formatMinutesToHHMM(attendance.totalMinutes);
            await attendance.save();
        }

        // Update User Activity - Unified field lastActiveAt
        await User.findByIdAndUpdate(userId, {
            lastActiveAt: new Date(),
            currentStatus: status
        });

        // Heartbeat status also broadcast to admins
        broadcastStatus(userId, status);

        res.json({
            success: true,
            total: attendance?.formattedTotalHours || "00:00",
            activeMinutes: Math.floor(attendance?.activeMinutes || 0)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get activity stats per individual (formatted HH:MM)
const getActivityStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const todayStr = new Date().toLocaleDateString('en-CA');

        const [user, attendance, allAttendance] = await Promise.all([
            User.findById(userId),
            Attendance.findOne({ user: userId, date: todayStr }),
            Attendance.find({ user: userId })
        ]);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const joinDate = user.joiningDate || user.createdAt;
        const diffTime = Math.abs(new Date() - new Date(joinDate));
        const totalDaysSinceJoined = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        const presentDays = allAttendance.length;
        const attendancePercent = Math.min(100, Math.round((presentDays / totalDaysSinceJoined) * 100));

        if (!attendance) {
            return res.json({
                totalHours: "00h 00m",
                activeTime: "00h 00m",
                idleTime: "00h 00m",
                breakTime: "00h 00m",
                checkIn: null,
                checkOut: null,
                attendancePercent: attendancePercent || 0
            });
        }

        const totalWorkMins = (attendance.activeMinutes || 0) + (attendance.idleMinutes || 0);
        const productivityPercent = totalWorkMins > 0
            ? Math.round((attendance.activeMinutes / totalWorkMins) * 100)
            : 0;

        const formatSutite = (val) => {
            if (typeof val === 'number') return formatMinutesToHHMM(val);
            if (typeof val === 'string' && val.includes(':')) {
                const [h, m] = val.split(':');
                return `${parseInt(h)}h ${parseInt(m)}m`;
            }
            return val || "0h 0m";
        };

        res.json({
            totalHours: formatSutite(attendance.formattedTotalHours || attendance.totalMinutes),
            activeTime: formatMinutesToHHMM(attendance.activeMinutes),
            idleTime: formatMinutesToHHMM(attendance.idleMinutes),
            breakTime: formatMinutesToHHMM(attendance.breakMinutes),
            checkIn: attendance.checkInTime,
            checkOut: attendance.checkOutTime,
            attendancePercent: attendancePercent || 0,
            productivityPercent: productivityPercent || 0,
            activeMinutes: attendance.activeMinutes,
            idleMinutes: attendance.idleMinutes,
            totalMinutes: attendance.totalMinutes
        });
    } catch (error) {
        console.error('[STATS-ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all active/recent activity logs
const getRecentActivity = async (req, res) => {
    try {
        const logs = await ActivityLog.find()
            .populate('user', 'name email profilePicture')
            .sort({ createdAt: -1 })
            .limit(15);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all employees with their live status and today's productivity
const getEmployeeLiveStatus = async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA');
        const employees = await User.find({ role: { $in: ['employee', 'seo-team'] } }).select('name email profilePicture currentStatus currentSessionId isOnline');
        const attendanceRecords = await Attendance.find({ date: today });

        const liveData = employees.map(emp => {
            const att = attendanceRecords.find(a => a.user.toString() === emp._id.toString());

            let productivityPercent = 0;
            if (att) {
                const totalMins = (att.activeMinutes || 0) + (att.idleMinutes || 0);
                productivityPercent = totalMins > 0 ? Math.round((att.activeMinutes / totalMins) * 100) : 0;
            }

            return {
                ...emp._doc,
                productivityPercent,
                totalMinutes: att ? att.totalMinutes : 0,
                formattedTotalHours: att ? (att.formattedTotalHours || formatMinutesToHHMM(att.totalMinutes)) : "00:00"
            };
        });

        res.json(liveData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { updateStatus, handleHeartbeat, getActivityStats, getRecentActivity, getEmployeeLiveStatus };
