const Message = require('../models/Message');

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await Message.countDocuments({
            recipient: userId,
            isSeen: false
        });
        res.json({ unreadCount: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const { senderId, groupId } = req.body;

        const filter = { recipient: userId, isSeen: false };
        if (groupId) {
            filter.groupId = groupId;
            delete filter.recipient; // For groups, we might want a middle-table for individual 'seen' status,
            // but for now let's mark it 'seen' for the UI flow.
            // WhatsApp-style seen per user requires a different schema.
            // Simplification: Mark as seen in UI locally.
        } else {
            filter.sender = senderId;
        }

        await Message.updateMany(filter, { $set: { isSeen: true } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getUnreadCount, markAsRead };
