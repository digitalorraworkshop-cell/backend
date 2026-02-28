const mongoose = require('mongoose');

const leaveSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    leaveType: {
        type: String,
        required: true
    },
    fromDate: {
        type: Date,
        required: true
    },
    toDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    totalDays: {
        type: Number,
        required: true,
        default: 1
    },
    sandwichDays: {
        type: Number,
        default: 0
    },
    deductionAmount: {
        type: Number,
        default: 0
    },
    proofDocument: {
        type: String // URL or path
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    adminRemark: {
        type: String
    },
    isEmergency: {
        type: Boolean,
        default: false
    },
    isSickness: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Leave = mongoose.model('Leave', leaveSchema);

module.exports = Leave;
