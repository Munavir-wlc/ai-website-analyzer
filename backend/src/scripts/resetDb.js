const mongoose = require('mongoose');
require('dotenv').config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-website-analyzer';

async function resetDb() {
  try {
    console.log(`Connecting to MongoDB: ${connStr}...`);
    await mongoose.connect(connStr);
    
    console.log('Dropping database for clean standard testing...');
    await mongoose.connection.db.dropDatabase();
    
    console.log('✅ Database dropped successfully! Clean database ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  }
}

resetDb();
