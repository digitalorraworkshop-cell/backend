const mongoose = require('mongoose');

const dailyUpdateSchema = mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    newWork: {
        type: String,
        default: ''
    },
    learning: {
        type: String,
        default: ''
    },
    challenges: {
        type: String,
        default: ''
    },
    solutions: {
        type: String,
        default: ''
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    completionPercentage: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['draft', 'submitted'],
        default: 'draft'
    },
    isLocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Ensure only one update per employee per date
dailyUpdateSchema.index({ employee: 1, date: 1 }, { unique: true });

const DailyUpdate = mongoose.model('DailyUpdate', dailyUpdateSchema);

module.exports = DailyUpdate;
