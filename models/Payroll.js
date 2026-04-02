const mongoose = require('mongoose');

const payrollSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    month: {
        type: Number, // 1-12
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    baseSalary: {
        type: Number,
        default: 0
    },
    totalDeductions: {
        type: Number,
        default: 0
    },
    netSalary: {
        type: Number,
        default: 0
    },
    leaves: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Leave'
    }]
}, {
    timestamps: true
});

const Payroll = mongoose.model('Payroll', payrollSchema);

module.exports = Payroll;
