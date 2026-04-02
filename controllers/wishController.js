const BirthdayWish = require('../models/BirthdayWish');

// @desc  Send a birthday wish
// @route POST /api/birthdays/wish
// @access Private
const sendWish = async (req, res) => {
    try {
        const { recipientId, message } = req.body;
        const senderId = req.user._id;

        if (senderId.toString() === recipientId) {
            return res.status(400).json({ message: "You cannot wish yourself!" });
        }

        const wish = await BirthdayWish.create({
            sender: senderId,
            recipient: recipientId,
            message
        });

        res.status(201).json(wish);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc  Get wishes received by the logged-in user
// @route GET /api/birthdays/received
// @access Private
const getReceivedWishes = async (req, res) => {
    try {
        const userId = req.user._id;
        const wishes = await BirthdayWish.find({ recipient: userId })
            .populate('sender', 'name profilePicture')
            .sort('-createdAt');

        res.json(wishes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc  Get wishes sent by the logged-in user
// @route GET /api/birthdays/sent
// @access Private
const getSentWishes = async (req, res) => {
    try {
        const userId = req.user._id;
        const wishes = await BirthdayWish.find({ sender: userId });
        res.json(wishes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc  Reply to a birthday wish
// @route PUT /api/birthdays/wish/:id/reply
// @access Private
const replyToWish = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;
        const userId = req.user._id;

        console.log(`[BIRTHDAY-REPLY-DEBUG] ID: ${id}, User: ${userId}, Msg: ${reply}`);

        const wish = await BirthdayWish.findById(id);

        if (!wish) {
            return res.status(404).json({ message: "Wish not found" });
        }

        if (wish.recipient.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You can only reply to wishes sent to you!" });
        }

        wish.reply = reply;
        wish.repliedAt = Date.now();
        await wish.save();

        res.json(wish);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { sendWish, getReceivedWishes, getSentWishes, replyToWish };
