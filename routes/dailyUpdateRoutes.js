const express = require('express');
const router = express.Router();
const {
    saveDailyUpdate,
    getDailyUpdateByDate,
    getEmployeeAnalytics,
    getEmployeeHistory,
    getAdminReports
} = require('../controllers/dailyUpdateController');
const { protect, admin } = require('../middleware/authMiddleware');

console.log('[DEBUG-SERVER] Registering DailyUpdate routes...');

router.post('/', protect, (req, res, next) => { console.log('[DEBUG-SERVER] POST /api/daily-updates'); next(); }, saveDailyUpdate);
router.get('/analytics', protect, (req, res, next) => { console.log('[DEBUG-SERVER] GET /api/daily-updates/analytics'); next(); }, getEmployeeAnalytics);
router.get('/history', protect, (req, res, next) => { console.log('[DEBUG-SERVER] GET /api/daily-updates/history'); next(); }, getEmployeeHistory);
router.get('/admin/reports', protect, admin, (req, res, next) => { console.log('[DEBUG-SERVER] GET /api/daily-updates/admin/reports'); next(); }, getAdminReports);
router.get('/:date', protect, (req, res, next) => { console.log('[DEBUG-SERVER] GET /api/daily-updates/' + req.params.date); next(); }, getDailyUpdateByDate);

module.exports = router;
