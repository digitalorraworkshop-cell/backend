const express = require('express');
const router = express.Router();
const { saveScreenshotMeta, getScreenshots } = require('../controllers/screenshotController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, saveScreenshotMeta)
    .get(protect, getScreenshots); // Admin can filter via query params

module.exports = router;
