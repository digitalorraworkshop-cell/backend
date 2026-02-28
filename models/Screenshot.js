const mongoose = require('mongoose');

const screenshotSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    imageUrl: {
        type: String,
        required: true
    },
    sessionId: {
        type: String,
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD for easier filtering
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Idle', 'Idle Warning', 'Tab Inactive', 'Lunch', 'Meeting', 'On Break'],
        default: 'Active'
    },
    activityPercentage: {
        type: Number,
        default: 0
    },
    activeApp: {
        type: String,
        default: 'Unknown Application'
    }
}, {
    timestamps: true
});

const Screenshot = mongoose.model('Screenshot', screenshotSchema);

module.exports = Screenshot;
