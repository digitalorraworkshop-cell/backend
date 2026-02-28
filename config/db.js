const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);

        if (!process.env.MONGO_URI) {
            console.error('[DB-ERROR] MONGO_URI is missing from environment variables.');
            process.exit(1);
        }

        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`[DB-SUCCESS] MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`[DB-FATAL] MongoDB Connection Failed: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
