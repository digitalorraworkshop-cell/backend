const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const resetAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const adminEmail = 'admin@example.com';
        const user = await User.findOne({ email: adminEmail });

        if (user) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash('password123', salt);
            await user.save();
            console.log(`Password for ${adminEmail} has been securely reset.`);
        } else {
            console.log(`User with email ${adminEmail} not found.`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
};

resetAdmin();
