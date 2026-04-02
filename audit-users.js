const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'name email role');
    console.log('ALL USERS IN DB:');
    users.forEach(u => console.log(`${u.name} | ${u.email} | ${u.role}`));
    process.exit();
}
check();
