const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const importData = async () => {
    try {
        await User.deleteMany();

        const adminUser = {
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin',
            phone: '1234567890',
            position: 'Administrator'
        };

        const assetsManagerUser = {
            name: 'Manoj Sir',
            email: 'manoj@example.com',
            password: 'password123',
            role: 'assets-manager',
            phone: '9876543210',
            position: 'Assets Manager'
        };

        await User.create([adminUser, assetsManagerUser]);

        console.log('Data Imported! (Admin & Assets Manager Created)');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await User.deleteMany();

        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
