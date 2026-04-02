const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, unique: true, sparse: true }, // Auto-generated
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'employee', 'seo-manager', 'seo-team', 'assets-manager', 'manager'], default: 'employee' },
    phone: { type: String },
    position: { type: String },
    salary: { type: Number }, // Monthly salary
    perDaySalary: { type: Number },
    workingHoursPerDay: { type: Number, default: 8 },
    attendanceDaysInMonth: { type: Number, default: 22 }, // Typical working days
    profilePicture: { type: String },
    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    currentStatus: {
        type: String,
        enum: ['Online', 'Working', 'Idle', 'Offline', 'On Break'],
        default: 'Offline'
    },
    currentSessionId: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
    socketId: { type: String },
    // For Employees
    department: { type: String },
    joiningDate: { type: Date, default: Date.now },
    dateOfBirth: { type: Date },
}, {
    timestamps: true
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    console.log(`[AUTH-DEBUG] Comparing passwords:`);
    console.log(`[AUTH-DEBUG] Input Password: "${enteredPassword}" (Length: ${enteredPassword.length})`);
    console.log(`[AUTH-DEBUG] Stored Hash:    "${this.password}" (Length: ${this.password.length})`);
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log(`[AUTH-DEBUG] Match Result:   ${isMatch}`);
    return isMatch;
};

userSchema.pre('save', async function () {
    console.log('[USER-DEBUG] Async pre-save hook triggered.');

    if (!this.isModified('password')) {
        console.log('[USER-DEBUG] Password not modified.');
        return;
    }

    // Safety: If it already looks like a bcrypt hash, don't hash it again
    if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
        console.log('[USER-DEBUG] Password already hashed.');
        return;
    }

    console.log('[USER-DEBUG] Hashing password...');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('[USER-DEBUG] Hashing complete.');
});

const User = mongoose.model('User', userSchema);

module.exports = User;
