const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const User = require('./models/User');

// Usage: node reset-password.js <username_or_email> <new_password>
// Example: node reset-password.js karankumar3386 MyNewPass123!

const resetPassword = async () => {
    const identifier = process.argv[2];
    const newPassword = process.argv[3];

    if (!identifier || !newPassword) {
        console.error('Usage: node reset-password.js <username_or_email> <new_password>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }]
        });

        if (!user) {
            console.error(`❌ No user found with identifier: ${identifier}`);
            process.exit(1);
        }

        user.password = newPassword;
        await user.save(); // pre-save hook will hash it

        console.log(`✅ Password reset for: ${user.name} (${user.username || user.email})`);
        console.log(`   New password: ${newPassword}`);
        console.log(`   Role: ${user.role}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

resetPassword();
