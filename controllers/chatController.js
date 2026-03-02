const Message = require('../models/Message');
const ChatGroup = require('../models/ChatGroup');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get messages between two users
// @route   GET /api/chat/messages/:recipientId
// @access  Private
const getMessages = async (req, res) => {
    try {
        const userId = req.user._id;
        const { recipientId } = req.params;
        const recipient = await User.findById(recipientId);

        // Security: Employees can only message Admins privately
        if (req.user.role === 'employee' && recipient.role === 'employee' && userId.toString() !== recipientId) {
            return res.status(403).json({ message: 'Employees can only message admins privately.' });
        }

        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            $or: [
                { sender: userId, recipient: recipientId },
                { sender: recipientId, recipient: userId }
            ],
            isGroup: false
        })
            .populate('sender', 'name profilePicture')
            .populate('recipient', 'name profilePicture')
            .sort({ createdAt: -1 }) // Sort latest first for pagination
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        // Return reversed to frontend (oldest to newest for chat window)
        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get group messages
// @route   GET /api/chat/group/:groupId
// @access  Private
const getGroupMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ groupId, isGroup: true })
            .populate('sender', 'name profilePicture')
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new chat group
// @route   POST /api/chat/groups
// @access  Private
const createGroup = async (req, res) => {
    try {
        const { name, members } = req.body;
        const group = await ChatGroup.create({
            name,
            members: [...members, req.user._id],
            admin: req.user._id
        });
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all chat groups user belongs to
// @route   GET /api/chat/groups
// @access  Private
const getGroups = async (req, res) => {
    try {
        const groups = await ChatGroup.find({ members: req.user._id })
            .populate('members', 'name profilePicture')
            .populate('admin', 'name');
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get conversations for current user (includes unread counts, last message, and groups)
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Fetch all users (Individual Chats)
        const users = await User.find({ _id: { $ne: userId } })
            .select('name email profilePicture role currentStatus isOnline');

        const userConversations = await Promise.all(users.map(async (u) => {
            const lastMessage = await Message.findOne({
                $or: [
                    { sender: userId, recipient: u._id },
                    { sender: u._id, recipient: userId }
                ],
                isGroup: false
            }).sort({ createdAt: -1 });

            const unreadCount = await Message.countDocuments({
                sender: u._id,
                recipient: userId,
                isSeen: false
            });

            return {
                _id: u._id,
                name: u.name,
                profilePicture: u.profilePicture,
                role: u.role,
                isOnline: u.isOnline,
                lastMessage: lastMessage ? lastMessage.message : null,
                lastMessageTime: lastMessage ? lastMessage.createdAt : null,
                unreadCount,
                isGroup: false
            };
        }));

        // 2. Fetch all groups user belongs to
        const groups = await ChatGroup.find({ members: userId });
        const groupConversations = await Promise.all(groups.map(async (g) => {
            const lastMessage = await Message.findOne({
                groupId: g._id,
                isGroup: true
            }).sort({ createdAt: -1 });

            // Note: Unread count for groups per user would need a more complex schema 
            // (e.g. tracking last seen timestamp per user per group). 
            // For now, we'll return 0 or a simplified count.
            return {
                _id: g._id,
                name: g.name,
                isGroup: true,
                lastMessage: lastMessage ? lastMessage.message : null,
                lastMessageTime: lastMessage ? lastMessage.createdAt : null,
                unreadCount: 0 // Simplified
            };
        }));

        // Merge and sort
        const combined = [...userConversations, ...groupConversations];
        combined.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        res.json(combined);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Ensure "Company Team" group exists
const ensureCompanyGroup = async () => {
    try {
        const group = await ChatGroup.findOne({ name: 'Company Team' });
        if (!group) {
            const admin = await User.findOne({ role: 'admin' });
            const employees = await User.find({ role: 'employee' });
            if (admin) {
                await ChatGroup.create({
                    name: 'Company Team',
                    members: [admin._id, ...employees.map(e => e._id)],
                    admin: admin._id
                });
                console.log('[CHAT] "Company Team" group created automatically.');
            }
        }
    } catch (err) {
        console.error('[CHAT-ERROR] ensureCompanyGroup failed:', err);
    }
};

// @desc    Upload image to Cloudinary and return URL
// @route   POST /api/chat/upload
// @access  Private
const uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'chat_images',
        });

        // Clean up local file
        fs.unlinkSync(req.file.path);

        res.json({ url: result.secure_url });
    } catch (error) {
        console.error('[CHAT-UPLOAD-ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMessages,
    getGroupMessages,
    createGroup,
    getGroups,
    getConversations,
    ensureCompanyGroup,
    uploadImage
};
