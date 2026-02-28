const express = require('express');
const router = express.Router();
const { applyLeave, getLeaves, updateLeaveStatus, getLeaveStats } = require('../controllers/leaveController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.route('/')
    .post(protect, upload.single('proofDocument'), applyLeave)
    .get(protect, getLeaves);

router.route('/stats')
    .get(protect, getLeaveStats);

router.route('/:id')
    .put(protect, admin, updateLeaveStatus);

module.exports = router;
