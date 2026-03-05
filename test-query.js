const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');
const User = require('./models/User');

const testHistory = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/employee-tracker');
        console.log('Connected to DB');

        const query = {
            user: new mongoose.Types.ObjectId('69a5691444a5b3d544536418'),
            date: { $gte: '2025-03-01', $lte: '2025-03-31' }
        };

        console.log('Running query:', JSON.stringify(query));
        const history = await Attendance.find(query)
            .populate('user', 'name email')
            .sort({ date: -1 });

        console.log(`Found ${history.length} records`);
        process.exit(0);
    } catch (error) {
        console.error('ERROR during test:', error);
        process.exit(1);
    }
};

testHistory();
