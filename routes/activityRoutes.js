const express = require('express');
const router = express.Router();
const { updateStatus, handleHeartbeat, getActivityStats, getRecentActivity, getEmployeeLiveStatus } = require('../controllers/activityController');
const { protect, admin, isManager } = require('../middleware/authMiddleware');

router.post('/status', protect, updateStatus);
router.post('/heartbeat', protect, handleHeartbeat);
router.get('/recent', protect, isManager, getRecentActivity);
router.get('/live-status', protect, isManager, getEmployeeLiveStatus);
router.get('/stats/:userId', protect, getActivityStats);

module.exports = router;
