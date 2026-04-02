const mongoose = require('mongoose');

const leaveBalanceSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    monthlyPaidLeaveBalance: {
        type: Number,
        default: 0
    },
    carryForwardLeave: {
        type: Number,
        default: 0
    },
    instantLeaveUsedThisYear: {
        type: Number,
        default: 0
    },
    shortLeaveUsedThisMonth: {
        type: Number,
        default: 0
    },
    lastInstantLeaveDate: {
        type: Date
    }
}, {
    timestamps: true
});

const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);

module.exports = LeaveBalance;
