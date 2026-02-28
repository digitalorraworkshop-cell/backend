const express = require('express');
const router = express.Router();
const { getMessages, getGroupMessages, createGroup, getGroups, getConversations, uploadImage } = require('../controllers/chatController');
const { getUnreadCount, markAsRead } = require('../controllers/unreadController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/messages/:recipientId', protect, getMessages);
router.get('/group/:groupId', protect, getGroupMessages);
router.post('/groups', protect, createGroup);
router.get('/groups', protect, getGroups);
router.get('/unread-count', protect, getUnreadCount);
router.post('/mark-read', protect, markAsRead);
router.get('/conversations', protect, getConversations);
router.post('/upload', protect, upload.single('file'), uploadImage);

module.exports = router;
