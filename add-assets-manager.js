const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');
dotenv.config();

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'manoj@example.com';
        
        // Remove existing if any
        await User.deleteMany({ email });
        
        const user = new User({
            name: 'Manoj Sir',
            email: email,
            password: 'password123', // Default password
            role: 'assets-manager',
            isActive: true
        });
        
        await user.save();
        console.log('-----------------------------------');
        console.log('Assets Manager Account Created!');
        console.log(`Name: Manoj Sir`);
        console.log(`Email: ${email}`);
        console.log(`Password: password123`);
        console.log('-----------------------------------');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
seed();
