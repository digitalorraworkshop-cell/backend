const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const resetEmployee = async (identifier) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({
            $or: [
                { username: identifier },
                { email: identifier }
            ]
        });

        if (user) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash('password123', salt);
            await user.save();
            console.log(`Password for user ${identifier} (${user.email}) has been securely reset to: password123`);
        } else {
            console.log(`User ${identifier} not found.`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const identifier = process.argv[2];
if (!identifier) {
    console.error('Usage: node reset-employee.js <username_or_email>');
    process.exit(1);
}

resetEmployee(identifier);
