const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const createSEOTeam = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const teamMembers = [
            { name: 'SEO Specialst 1', email: 'seo1@example.com', username: 'seo1', role: 'seo-team', department: 'SEO' },
            { name: 'SEO Assistant 2', email: 'seo2@example.com', username: 'seo2', role: 'seo-team', department: 'SEO' }
        ];

        for (const member of teamMembers) {
            const exists = await User.findOne({ email: member.email });
            if (!exists) {
                await User.create({
                    ...member,
                    password: 'Password@123',
                    phone: '9876543210',
                    position:  member.name.includes('Specialst') ? 'Specialist' : 'Assistant',
                    isActive: true
                });
                console.log(`Created: ${member.name}`);
            } else {
                console.log(`Skipped: ${member.name} (Already exists)`);
            }
        }

        process.exit();
    } catch (error) {
        console.error('Error creating SEO Team:', error);
        process.exit(1);
    }
};

createSEOTeam();
