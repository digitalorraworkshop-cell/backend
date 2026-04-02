const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await User.countDocuments({});
        console.log('Total Users:', count);
        const adminCount = await User.countDocuments({ role: 'admin' });
        const empCount = await User.countDocuments({ role: { $in: ['employee', 'seo-team'] } });
        const managerCount = await User.countDocuments({ role: 'seo-manager' });
        
        console.log('Admins:', adminCount);
        console.log('Employees/SEO-Team:', empCount);
        console.log('Managers:', managerCount);
        
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
