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
        const now = new Date();
        const today = now.toLocaleDateString('en-CA');

        const user = await User.findById(userId);

        // Check today's attendance record
        let attendance = await Attendance.findOne({ user: userId, date: today });

        const hasActiveSession = attendance && attendance.checkInTime && !attendance.checkOutTime && attendance.status === 'Working';

        if (hasActiveSession && user && user.currentSessionId) {
            return res.status(400).json({ message: "Already checked in or session active" });
        }

        if (user && user.currentSessionId && !hasActiveSession) {
            await User.findByIdAndUpdate(userId, {
                currentSessionId: null,
                isOnline: false,
                currentStatus: 'Offline'
            });
        }

        // Auto-mark Late if check-in after 10:00 AM
        const checkInTime = now;
        const tenAM = new Date(now);
        tenAM.setHours(10, 0, 0, 0);

        let initialStatus = "Working";
        if (checkInTime > tenAM) {
            initialStatus = "Late";
        }

        if (attendance && attendance.checkOutTime && attendance.status === 'Completed') {
            attendance.checkOutTime = null;
            attendance.status = initialStatus;
        } else if (!attendance) {
            attendance = new Attendance({
                user: userId,
                date: today,
                status: initialStatus
            });
        } else {
            attendance.status = initialStatus;
        }

        const sessionId = new mongoose.Types.ObjectId().toString();
        attendance.checkInTime = checkInTime;
        attendance.image = req.file ? req.file.path : attendance.image;

        await attendance.save();

        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            currentStatus: 'Working',
            currentSessionId: sessionId
        });
        broadcastStatus(userId, 'Working');

        res.status(200).json({
            checkInTime: attendance.checkInTime,
            sessionId: sessionId,
            status: attendance.status
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

        const diffMs = new Date(attendance.checkOutTime) - new Date(attendance.checkInTime);
        const sessionMins = Math.max(0, Math.floor(diffMs / 60000));

        attendance.totalMinutes = (attendance.totalMinutes || 0) + sessionMins;
        attendance.formattedTotalHours = formatMinutes(attendance.totalMinutes);

        // Status Logic
        // If work duration < 4 hours (240 mins) -> Half Day
        // Else if it was already Late -> Late
        // Else -> Present
        if (attendance.totalMinutes < 240) {
            attendance.status = "Half Day";
        } else if (attendance.status === "Late") {
            // Keep it Late
        } else {
            attendance.status = "Present";
        }

        // Technically 'Completed' in original flow, but user wants 'Present'/'Late'/'Half Day'
        // We'll use these statuses instead of 'Completed' for record-keeping.

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
            totalMinutes: attendance.totalMinutes,
            status: attendance.status
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
        const staffRoles = ['employee', 'seo-team'];
        console.log(`[DASHBOARD-DEBUG] Fetching stats for roles: ${staffRoles}`);
        const [totalEmployees, onlineUserCount, attendanceRecords] = await Promise.all([
            User.countDocuments({ role: { $in: staffRoles } }),
            User.countDocuments({ role: { $in: staffRoles }, isOnline: true }),
            Attendance.find({ date: today }).populate('user', 'role')
        ]);
        console.log(`[DASHBOARD-DEBUG] Stats found - Total: ${totalEmployees}, Online: ${onlineUserCount}`);

        const workingEmployees = attendanceRecords.filter(a => ['Working', 'On Break', 'Late'].includes(a.status)).length;
        const presentCount = attendanceRecords.length;
        const absentCount = Math.max(0, totalEmployees - presentCount);
        const lateCount = attendanceRecords.filter(a => a.status === 'Late').length;

        const totalMinutes = attendanceRecords.reduce((acc, curr) => acc + (curr.totalMinutes || 0), 0);
        const avgMinutes = presentCount > 0 ? totalMinutes / presentCount : 0;

        res.status(200).json({
            totalEmployees,
            onlineEmployees: onlineUserCount,
            workingEmployees,
            todayPresent: presentCount,
            todayAbsent: absentCount,
            lateEmployees: lateCount,
            avgWorkHours: formatMinutes(avgMinutes)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Attendance History with filters
// @route   GET /api/attendance/history
// @access  Private/Admin
const getAttendanceHistory = async (req, res) => {
    try {
        console.log('[GOD-MODE] History API Hit:', req.query);
        const { userId, startDate, endDate, month, year } = req.query;
        let query = {};

        if (userId && userId !== 'undefined' && userId !== 'null') {
            const cleanId = String(userId).trim();
            console.log('[GOD-MODE] Processing UserID:', cleanId);
            if (mongoose.Types.ObjectId.isValid(cleanId)) {
                query.user = new mongoose.Types.ObjectId(cleanId);
                console.log('[GOD-MODE] UserID is valid ObjectId');
            } else {
                console.warn('[GOD-MODE] Invalid userId format:', cleanId);
            }
        }

        if (startDate && endDate && startDate !== 'undefined' && endDate !== 'undefined') {
            console.log('[GOD-MODE] Date Range Filter:', startDate, 'to', endDate);
            query.date = { $gte: String(startDate), $lte: String(endDate) };
        } else if (month && year && month !== 'undefined' && year !== 'undefined') {
            console.log('[GOD-MODE] Month/Year Filter:', month, '/', year);
            const m = String(month).padStart(2, '0');
            const y = String(year);
            const startStr = `${y}-${m}-01`;
            const endStr = `${y}-${m}-31`;
            query.date = { $gte: startStr, $lte: endStr };
            console.log(`[GOD-MODE] Range string built: ${startStr} to ${endStr}`);
        } else if (year && year !== 'undefined' && year !== 'null') {
            console.log('[GOD-MODE] Year Only Filter:', year);
            query.date = { $regex: new RegExp(`^${year}-`) };
        }

        console.log('[GOD-MODE] Executing Find with Query:', JSON.stringify(query));
        const history = await Attendance.find(query)
            .populate('user', 'name email')
            .sort({ date: -1 });

        console.log(`[GOD-MODE] Find Success. Records: ${history.length}`);
        res.status(200).json(history);
    } catch (error) {
        console.error('[GOD-MODE-FATAL]:', error);
        res.status(500).json({
            message: "Failed to fetch attendance history",
            error: error.message,
            stack: error.stack,
            query: req.query
        });
    }
};

// @desc    Get Employee Summary
// @route   GET /api/attendance/summary
// @access  Private
const getEmployeeSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const records = await Attendance.find({ user: userId });

        const totalWorkingDays = records.length;
        const lateDays = records.filter(r => r.status === 'Late').length;
        const halfDays = records.filter(r => r.status === 'Half Day').length;
        const totalMinutes = records.reduce((acc, curr) => acc + (curr.totalMinutes || 0), 0);

        res.status(200).json({
            totalWorkingDays,
            lateDays,
            halfDays,
            totalHoursWorked: formatMinutes(totalMinutes),
            totalAbsents: 0
        });
    } catch (error) {
        console.error('[ATTENDANCE-SUMMARY-ERROR]:', error);
        res.status(500).json({
            message: "Failed to fetch attendance summary",
            error: error.message
        });
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

// @desc    Get all employees attendance for a specific date
// @route   GET /api/attendance/by-date
// @access  Private/Admin
const getAttendanceByDate = async (req, res) => {
    try {
        const { date } = req.query; // YYYY-MM-DD
        if (!date) return res.status(400).json({ message: "Date is required" });

        // Get all employees (including SEO Team)
        const employees = await User.find({ role: { $in: ['employee', 'seo-team'] }, isActive: true })
            .select('name email department position')
            .sort({ name: 1 });

        // Get attendance for these employees on this date
        const attendanceRecords = await Attendance.find({ date });

        // Merge employees with their attendance records
        const data = employees.map(emp => {
            const record = attendanceRecords.find(r => r.user.toString() === emp._id.toString());
            return {
                employee: emp,
                attendance: record || {
                    user: emp._id,
                    date: date,
                    status: 'Absent', // Default to Absent if no record found
                    checkInTime: null,
                    checkOutTime: null,
                    totalMinutes: 0,
                    breakMinutes: 0,
                    remarks: "",
                    markedByAdmin: false
                }
            };
        });

        res.status(200).json(data);
    } catch (error) {
        console.error('[ATTENDANCE-BY-DATE-ERROR]:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// @desc    Bulk Update Attendance
// @route   POST /api/attendance/bulk-update
// @access  Private/Admin
const bulkUpdateAttendance = async (req, res) => {
    try {
        const { date, records } = req.body;
        if (!date || !records || !Array.isArray(records)) {
            return res.status(400).json({ message: "Invalid data provided" });
        }

        const results = [];

        for (const item of records) {
            const { userId, status, checkInTime, checkOutTime, breakMinutes, remarks } = item;

            let attendance = await Attendance.findOne({ user: userId, date });

            if (!attendance) {
                attendance = new Attendance({ user: userId, date });
            }

            attendance.status = status;
            attendance.remarks = remarks || "";
            attendance.markedByAdmin = true;
            attendance.breakMinutes = Number(breakMinutes) || 0;

            if (status === 'Absent' || status === 'Leave') {
                attendance.checkInTime = null;
                attendance.checkOutTime = null;
                attendance.totalMinutes = 0;
            } else {
                attendance.checkInTime = checkInTime ? new Date(checkInTime) : attendance.checkInTime;
                attendance.checkOutTime = checkOutTime ? new Date(checkOutTime) : attendance.checkOutTime;

                // Recalculate duration if both times exist
                if (attendance.checkInTime && attendance.checkOutTime) {
                    const diffMs = new Date(attendance.checkOutTime) - new Date(attendance.checkInTime);
                    attendance.totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
                    attendance.formattedTotalHours = formatMinutes(attendance.totalMinutes);
                }
            }

            await attendance.save();
            results.push(attendance);
        }

        res.status(200).json({ message: "Attendance updated successfully", count: results.length });
    } catch (error) {
        console.error('[ATTENDANCE-BULK-UPDATE-ERROR]:', error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
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
    endBreak,
    getAttendanceHistory,
    getEmployeeSummary,
    getAttendanceByDate,
    bulkUpdateAttendance
};
