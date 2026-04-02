const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const createSEOManager = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const email = 'seomanager@example.com';
        const password = 'Password@123';
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('SEO Manager already exists with this email.');
            process.exit();
        }

        const user = await User.create({
            name: 'SEO Manager',
            email: email,
            username: 'seomanager',
            password: password, // Pre-save hook will hash it
            role: 'seo-manager',
            phone: '1234567890',
            position: 'SEO Manager',
            department: 'SEO',
            isActive: true
        });

        console.log('-----------------------------------');
        console.log('SEO Manager Created Successfully!');
        console.log('Email: seomanager@example.com');
        console.log('Password: Password@123');
        console.log('-----------------------------------');

        process.exit();
    } catch (error) {
        console.error('Error creating SEO Manager:', error);
        process.exit(1);
    }
};

createSEOManager();
