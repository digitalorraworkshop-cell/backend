const mongoose = require('mongoose');

const attendanceSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    checkInTime: {
        type: Date
    },
    checkOutTime: {
        type: Date
    },
    totalMinutes: {
        type: Number,
        default: 0
    },
    activeMinutes: {
        type: Number,
        default: 0
    },
    idleMinutes: {
        type: Number,
        default: 0
    },
    breakMinutes: {
        type: Number,
        default: 0
    },
    formattedTotalHours: {
        type: String,
        default: "00:00"
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late', 'Half Day', 'Working', 'Completed', 'On Break', 'Leave'],
        default: 'Working'
    },
    remarks: {
        type: String,
        default: ""
    },
    markedByAdmin: {
        type: Boolean,
        default: false
    },
    breakStartTime: {
        type: Date,
        default: null
    },
    image: {
        type: String
    }
}, {
    timestamps: true
});

// Production Indexes
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
