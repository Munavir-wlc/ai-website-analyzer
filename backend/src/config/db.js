const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-website-analyzer';
    const conn = await mongoose.connect(connStr);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB] Connection failed: ${error.message}`);
    console.error('[MongoDB] Please ensure MongoDB is running and MONGODB_URI is correctly configured in your .env file.');
    process.exit(1);
  }
};

module.exports = connectDB;
