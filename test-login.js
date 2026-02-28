const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const testLogin = async (email, password) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({
            $or: [
                { email: email.toLowerCase().trim() },
                { username: email.toLowerCase().trim() }
            ]
        });

        if (!user) {
            console.log('User not found');
            await mongoose.disconnect();
            return;
        }

        console.log(`User found: ${user.name}`);
        const isMatch = await user.matchPassword(password);
        console.log(`Match Result: ${isMatch}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
};

// Test with admin account
testLogin('admin@example.com', 'password123');
