const mongoose = require('mongoose');

const activityLogSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    status: {
        type: String,
        required: true,
        enum: ['Active', 'Working', 'Idle', 'Idle Warning', 'Lunch', 'Meeting', 'Offline', 'On Break', 'Tab Inactive']
    },
    sessionId: {
        type: String,
        required: true
    },
    activeWindowTitle: { type: String },
    url: { type: String },
    keystrokesCount: { type: Number, default: 0 },
    mouseClicks: { type: Number, default: 0 },
    idleTime: { type: Number, default: 0 }, // In seconds
    activeTime: { type: Number, default: 0 }, // In seconds
    startTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // In seconds
        default: 0
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true
    }
}, {
    timestamps: true
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
