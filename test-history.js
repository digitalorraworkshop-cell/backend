const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');
const User = require('./models/User');

const testHistory = async () => {
    try {
        const userId = '69a5691444a5b3d544536418';
        const month = '3';
        const year = '2025';

        let query = {};
        if (userId) query.user = userId;

        if (month && year) {
            const startStr = `${year}-${month.padStart(2, '0')}-01`;
            const endStr = `${year}-${month.padStart(2, '0')}-31`;
            query.date = { $gte: startStr, $lte: endStr };
            console.log('Query:', JSON.stringify(query));
        }

        console.log('Test successful if no error follows');
        process.exit(0);
    } catch (error) {
        console.error('FAILED:', error);
        process.exit(1);
    }
};

testHistory();
