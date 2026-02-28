const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getUpcomingBirthdays, getAdminBirthdays } = require('../controllers/birthdayController');
const { sendWish, getReceivedWishes, getSentWishes, replyToWish } = require('../controllers/wishController');

// All authenticated users can see upcoming birthdays
router.get('/upcoming', protect, getUpcomingBirthdays);

// Admin-only: filtered birthday report
router.get('/admin', protect, admin, getAdminBirthdays);

// Birthday wishes
router.post('/wish', protect, sendWish);
router.get('/received', protect, getReceivedWishes);
router.get('/sent', protect, getSentWishes);
router.put('/wish/:id/reply', protect, replyToWish);
router.put('/:id/reply', protect, replyToWish); // Fallback in case frontend omits /wish/


module.exports = router;
