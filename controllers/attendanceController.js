const Attendance = require('../models/Attendance');
const User = require('../models/User');
const mongoose = require('mongoose');
const { formatMinutes, getDurationInMinutes } = require('../utils/timeUtils');
const { broadcastStatus } = require('../socket');

// @desc    Check In
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');

        const user = await User.findById(userId);

        // Check today's attendance record first
        let attendance = await Attendance.findOne({ user: userId, date: today });

        // Block re-check-in only if there's an active (not completed) session today
        const hasActiveSession = attendance && attendance.checkInTime && !attendance.checkOutTime && attendance.status === 'Working';

        if (hasActiveSession && user && user.currentSessionId) {
            return res.status(400).json({ message: "Already checked in or session active" });
        }

        // If currentSessionId is set but no active attendance (stale from server restart), clear it
        if (user && user.currentSessionId && !hasActiveSession) {
            await User.findByIdAndUpdate(userId, {
                currentSessionId: null,
                isOnline: false,
                currentStatus: 'Offline'
            });
        }

        if (attendance && attendance.checkOutTime && attendance.status === 'Completed') {
            attendance.checkOutTime = null;
            attendance.status = 'Working';
        } else if (!attendance) {
            attendance = new Attendance({
                user: userId,
                date: today
            });
        }

        const sessionId = new mongoose.Types.ObjectId().toString();
        attendance.checkInTime = new Date();
        attendance.status = "Working";
        attendance.image = req.file ? req.file.path : attendance.image;

        await attendance.save();

        // Sync User Presence and Session
        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            currentStatus: 'Working',
            currentSessionId: sessionId
        });
        broadcastStatus(userId, 'Working');

        res.status(200).json({
            checkInTime: attendance.checkInTime,
            sessionId: sessionId,
            status: "Working"
        });
    } catch (error) {
        console.error('[STABILIZATION] Check-In Error:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// @desc    Check Out
// @route   POST /api/attendance/check-out
// @access  Private
const checkOut = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');

        const attendance = await Attendance.findOne({ user: userId, date: today });

        if (!attendance) {
            return res.status(400).json({ message: "No check-in found" });
        }

        if (attendance.checkOutTime && attendance.status === 'Completed') {
            return res.status(400).json({ message: "Already checked out" });
        }

        attendance.checkOutTime = new Date();

        // Calculate totalMinutes = Math.floor((out - in) / 60000)
        // Note: If multiple check-ins occur, we should accumulate duration.
        // For simplicity of this fix, we assume one session per day or cumulative duration if we change models.
        // Current model has totalMinutes as a single field.
        const diffMs = new Date(attendance.checkOutTime) - new Date(attendance.checkInTime);
        const sessionMins = Math.max(0, Math.floor(diffMs / 60000));

        attendance.totalMinutes = (attendance.totalMinutes || 0) + sessionMins;
        attendance.formattedTotalHours = formatMinutes(attendance.totalMinutes);
        attendance.status = "Completed";

        await attendance.save();

        // Sync User Presence
        await User.findByIdAndUpdate(userId, {
            isOnline: false,
            currentStatus: 'Offline',
            currentSessionId: null
        });
        broadcastStatus(userId, 'Offline');

        res.status(200).json({
            checkOutTime: attendance.checkOutTime,
            totalMinutes: attendance.totalMinutes
        });
    } catch (error) {
        console.error('[STABILIZATION] Check-Out Error:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// @desc    Get attendance for today (Timer Sync)
// @route   GET /api/attendance/today
// @access  Private
const getTodayAttendance = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');
        const attendance = await Attendance.findOne({ user: userId, date: today });

        const now = new Date();

        if (!attendance) {
            return res.status(200).json({
                checkedIn: false,
                working: false,
                totalMinutes: 0
            });
        }

        // If checkInTime exists AND no checkOutTime
        if (attendance.checkInTime && !attendance.checkOutTime) {
            const elapsedMs = now - new Date(attendance.checkInTime);
            return res.status(200).json({
                checkedIn: true,
                working: true,
                onBreak: attendance.status === 'On Break',
                breakStartTime: attendance.breakStartTime || null,
                checkInTime: attendance.checkInTime,
                sessionId: req.user.currentSessionId,
                totalMinutes: Math.max(0, Math.floor(elapsedMs / 60000)),
                date: attendance.date
            });
        }

        // If checkOutTime exists
        if (attendance.checkOutTime) {
            return res.status(200).json({
                checkedIn: true,
                working: false,
                checkInTime: attendance.checkInTime,
                checkOutTime: attendance.checkOutTime,
                totalMinutes: attendance.totalMinutes
            });
        }

        // Fallback for safety (should not reach here if logic holds)
        return res.status(200).json({
            checkedIn: !!attendance.checkInTime,
            working: attendance.status === 'Working',
            totalMinutes: attendance.totalMinutes || 0
        });

    } catch (error) {
        console.error('[STABILIZATION] Today API Error:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Admin methods preserved
const getAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.find({ user: req.params.id }).sort({ date: -1 });
        res.status(200).json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllAttendance = async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA');
        const attendance = await Attendance.find({ date: today })
            .populate('user', 'name email role currentStatus isOnline')
            .sort({ createdAt: -1 });
        res.status(200).json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAdminStats = async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA');
        const [totalEmployees, onlineUserCount, attendanceRecords] = await Promise.all([
            User.countDocuments({ role: 'employee' }),
            User.countDocuments({ role: 'employee', isOnline: true }),
            Attendance.find({ date: today }).populate('user', 'role')
        ]);

        const workingEmployees = attendanceRecords.filter(a => a.status === 'Working').length;
        const presentCount = attendanceRecords.length;
        const absentCount = Math.max(0, totalEmployees - presentCount);

        const totalMinutes = attendanceRecords.reduce((acc, curr) => acc + (curr.totalMinutes || 0), 0);

        res.status(200).json({
            totalEmployees,
            onlineEmployees: onlineUserCount,
            workingEmployees,
            todayPresent: presentCount,
            todayAbsent: absentCount,
            totalWorkHours: formatMinutes(totalMinutes)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Start Break
// @route   POST /api/attendance/break-start
// @access  Private
const startBreak = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');

        const attendance = await Attendance.findOne({ user: userId, date: today });
        if (!attendance || attendance.status !== 'Working') {
            return res.status(400).json({ message: 'No active working session found' });
        }
        if (attendance.breakStartTime) {
            return res.status(400).json({ message: 'Already on break' });
        }

        attendance.breakStartTime = new Date();
        attendance.status = 'On Break';
        await attendance.save();

        await User.findByIdAndUpdate(userId, { currentStatus: 'On Break' });
        broadcastStatus(userId, 'On Break');

        res.status(200).json({ breakStartTime: attendance.breakStartTime, status: 'On Break' });
    } catch (error) {
        console.error('[BREAK] Start Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// @desc    End Break
// @route   POST /api/attendance/break-end
// @access  Private
const endBreak = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date().toLocaleDateString('en-CA');

        const attendance = await Attendance.findOne({ user: userId, date: today });
        if (!attendance || !attendance.breakStartTime) {
            return res.status(400).json({ message: 'No active break found' });
        }

        const breakDurationMs = new Date() - new Date(attendance.breakStartTime);
        const breakMins = Math.max(0, Math.floor(breakDurationMs / 60000));

        attendance.breakMinutes = (attendance.breakMinutes || 0) + breakMins;
        attendance.breakStartTime = null;
        attendance.status = 'Working';
        await attendance.save();

        await User.findByIdAndUpdate(userId, { currentStatus: 'Working' });
        broadcastStatus(userId, 'Working');

        res.status(200).json({ breakMinutes: attendance.breakMinutes, status: 'Working' });
    } catch (error) {
        console.error('[BREAK] End Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    checkIn,
    checkOut,
    getAttendance,
    getAllAttendance,
    getTodayAttendance,
    getAdminStats,
    startBreak,
    endBreak
};
