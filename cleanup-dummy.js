const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const res = await User.deleteMany({ 
            email: { $in: ['seo1@example.com', 'seo2@example.com', 'seomanager@example.com'] } 
        });
        console.log(`Removed ${res.deletedCount} dummy employees.`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

cleanup();
