const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');

const seedAdmin = async () => {
    try {
        console.log('-----------------------------------------');
        console.log('[SEEDER] Starting MongoDB Connection...');

        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing in .env file');
        }

        await mongoose.connect(process.env.MONGO_URI);

        console.log(`[SEEDER] Connected to DB: ${mongoose.connection.name}`);

        if (mongoose.connection.name !== 'employee-tracker') {
            console.warn(`[SEEDER-WARNING] Connecting to "${mongoose.connection.name}". Expected "employee-tracker".`);
        }

        const adminEmail = 'admin@example.com';
        console.log(`[SEEDER] Cleaning up existing admin: ${adminEmail} (if any)`);
        await User.deleteMany({ email: adminEmail });

        console.log(`[SEEDER] Creating new admin user: ${adminEmail}`);
        const admin = await User.create({
            name: 'System Admin',
            email: adminEmail,
            username: 'admin',
            password: 'password123', // Will be hashed by pre-save hook
            role: 'admin',
            position: 'Super Admin',
            department: 'Management'
        });

        await LeaveBalance.deleteMany({ user: admin._id });
        await LeaveBalance.create({
            user: admin._id,
            monthlyPaidLeaveBalance: 1
        });

        console.log('[SEEDER] Admin user created & verified successfully!');
        console.log('[SEEDER] Database:', mongoose.connection.name);
        console.log('[SEEDER] Collection:', User.collection.name);
        console.log('-----------------------------------------');
        process.exit(0);
    } catch (error) {
        console.error('[SEEDER-ERROR]', error.message);
        process.exit(1);
    }
};

seedAdmin();
