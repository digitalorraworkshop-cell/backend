const DailyUpdate = require('../models/DailyUpdate');
const Task = require('../models/Task');

// @desc    Save or auto-save daily update
// @route   POST /api/daily-updates
// @access  Private
const saveDailyUpdate = async (req, res) => {
    try {
        const { date, newWork, learning, challenges, solutions, rating, status } = req.body;
        const employeeId = req.user._id;

        // Check if date is today or locked
        const today = new Date().toISOString().split('T')[0];
        const isPastDate = new Date(date) < new Date(today);

        // Calculate completion percentage from Tasks
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const tasks = await Task.find({
            assignedTo: employeeId,
            dueDate: { $gte: startOfDay, $lte: endOfDay }
        });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Completed').length;
        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        let update = await DailyUpdate.findOne({ employee: employeeId, date });

        if (update && update.isLocked) {
            return res.status(403).json({ message: 'This update is locked and cannot be modified' });
        }

        if (update) {
            update.newWork = newWork || update.newWork;
            update.learning = learning || update.learning;
            update.challenges = challenges || update.challenges;
            update.solutions = solutions || update.solutions;
            update.rating = rating !== undefined ? rating : update.rating;

            // Safeguard: Don't revert from 'submitted' to 'draft'
            if (status === 'submitted' || (update.status !== 'submitted' && status)) {
                update.status = status;
            }

            update.completionPercentage = completionPercentage;
            await update.save();
        } else {
            update = await DailyUpdate.create({
                employee: employeeId,
                date,
                newWork,
                learning,
                challenges,
                solutions,
                rating,
                status: status || 'draft',
                completionPercentage
            });
        }

        res.json(update);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get update for a specific date
// @route   GET /api/daily-updates/:date
// @access  Private
const getDailyUpdateByDate = async (req, res) => {
    try {
        const { date } = req.params;
        const employeeId = req.user._id;

        const update = await DailyUpdate.findOne({ employee: employeeId, date });

        if (!update) {
            // No entry yet for this date — return null so frontend shows blank form
            return res.json(null);
        }

        // Auto-locking logic check (if request is for a past date)
        const today = new Date().toISOString().split('T')[0];
        if (!update.isLocked && date < today) {
            update.isLocked = true;
            await update.save();
        }

        res.json(update);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get analytics for employee
// @route   GET /api/daily-updates/analytics
// @access  Private
const getEmployeeAnalytics = async (req, res) => {
    try {
        const employeeId = req.user._id;
        const updates = await DailyUpdate.find({ employee: employeeId }).sort({ date: -1 });

        // Calculate Streak
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        let checkDate = new Date(today);

        for (const up of updates) {
            const upDate = new Date(up.date);
            // Ignore future dates or today if not yet submitted?
            // Simple streak: continuous days with updates
            const diffDays = Math.floor((checkDate - upDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
                streak++;
                checkDate = upDate;
            } else {
                break;
            }
        }

        // Weekly Average Performance
        const last7Days = updates.slice(0, 7);
        const avgRating = last7Days.length > 0 ? (last7Days.reduce((acc, curr) => acc + curr.rating, 0) / last7Days.length).toFixed(1) : 0;
        const avgCompletion = last7Days.length > 0 ? (last7Days.reduce((acc, curr) => acc + curr.completionPercentage, 0) / last7Days.length).toFixed(0) : 0;

        res.json({
            streak,
            avgRating,
            avgCompletion,
            totalUpdates: updates.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin: Get all reports
// @route   GET /api/daily-updates/admin/reports
// @access  Private/Admin
const getAdminReports = async (req, res) => {
    try {
        const { employeeId, startDate, endDate } = req.query;
        let query = {};

        if (employeeId) query.employee = employeeId;
        if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        }

        const reports = await DailyUpdate.find(query)
            .populate('employee', 'name email profilePicture')
            .sort({ date: -1 });

        // Calculate Analytics for the filtered set
        const total = reports.length;
        const avgRating = total > 0 ? (reports.reduce((acc, curr) => acc + (curr.rating || 0), 0) / total).toFixed(1) : 0;
        const lowPerformers = reports.filter(r => r.completionPercentage < 50).length;

        // Simple aggregate for charts (ratings over time)
        const timeline = {};
        reports.forEach(r => {
            if (!timeline[r.date]) timeline[r.date] = { count: 0, sum: 0, completion: 0 };
            timeline[r.date].count++;
            timeline[r.date].sum += r.rating;
            timeline[r.date].completion += r.completionPercentage;
        });

        const chartData = Object.keys(timeline).sort().map(date => ({
            date,
            rating: (timeline[date].sum / timeline[date].count).toFixed(1),
            completion: (timeline[date].completion / timeline[date].count).toFixed(0)
        }));

        const statusData = [
            { name: 'Submitted', count: reports.filter(r => r.status === 'submitted').length },
            { name: 'Draft', count: reports.filter(r => r.status === 'draft').length },
            { name: 'Locked', count: reports.filter(r => r.isLocked).length }
        ];

        res.json({
            reports,
            analytics: {
                avgRating,
                lowPerformers,
                topStreak: 0, // In a real app, calculate across all active users
                chartData,
                statusData
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get history for employee (last 10 updates)
// @route   GET /api/daily-updates/history
// @access  Private
const getEmployeeHistory = async (req, res) => {
    try {
        const employeeId = req.user._id;
        const history = await DailyUpdate.find({ employee: employeeId })
            .sort({ date: -1 })
            .limit(10);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    saveDailyUpdate,
    getDailyUpdateByDate,
    getEmployeeAnalytics,
    getEmployeeHistory,
    getAdminReports
};
