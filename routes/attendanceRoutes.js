const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getAttendance, getAllAttendance, getTodayAttendance, getAdminStats, startBreak, endBreak } = require('../controllers/attendanceController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.post('/check-in', protect, upload.single('image'), checkIn);
router.post('/check-out', protect, checkOut);
router.post('/checkout', protect, checkOut);
router.post('/break-start', protect, startBreak);
router.post('/break-end', protect, endBreak);
router.get('/stats', protect, admin, getAdminStats);
router.get('/today', protect, getTodayAttendance);
router.get('/user/:id', protect, getAttendance);
router.get('/:id', protect, getAttendance);
router.get('/', protect, admin, getAllAttendance);

module.exports = router;

