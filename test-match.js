const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const testMatching = async (identifier, password) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        });

        if (!user) {
            console.log(`User "${identifier}" not found`);
            await mongoose.disconnect();
            return;
        }

        console.log(`User found: ${user.name} (${user.username})`);
        const isMatch = await user.matchPassword(password);
        console.log(`Match Result for password "${password}": ${isMatch}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err.message);
    }
};

const idArg = process.argv[2] || 'admin@example.com';
const passArg = process.argv[3] || 'password123';
testMatching(idArg, passArg);
