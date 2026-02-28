const mongoose = require('mongoose');

const breakLogSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    type: {
        type: String,
        required: true,
        enum: ['Lunch', 'Meeting']
    },
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

const BreakLog = mongoose.model('BreakLog', breakLogSchema);

module.exports = BreakLog;
