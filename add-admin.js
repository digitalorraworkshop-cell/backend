/*
This script adds a new admin user to the employee-tracker MongoDB database.
*/
const mongoose = require('mongoose');
const User = require('./models/User'); // Path to the User model
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const addAdmin = async (name, email, password) => {
    try {
        console.log(`[DB] Attempting to connect to: ${process.env.MONGO_URI}`);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[DB] Connected to MongoDB!');

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log(`[ERROR] User with email "${email}" already exists.`);
            await mongoose.disconnect();
            return;
        }

        const newUser = new User({
            name,
            email,
            password, // Password will be hashed by User model pre-save hook
            role: 'admin',
            position: 'Administrator',
            isActive: true
        });

        await newUser.save();
        console.log(`[SUCCESS] Admin user created!`);
        console.log(`- Name: ${name}`);
        console.log(`- Email: ${email}`);
        console.log(`- Password: ${password}`); // Displayed for confirmation; remove after use!

        await mongoose.disconnect();
    } catch (err) {
        console.error('[DATABASE ERROR] Failed to add admin:', err);
    }
};

// Default details (can be modified here before running)
const adminName = 'Admin';
const adminEmail = 'admin@kind.org.in';
const adminPassword = 'AdminPassword123';

addAdmin(adminName, adminEmail, adminPassword);
