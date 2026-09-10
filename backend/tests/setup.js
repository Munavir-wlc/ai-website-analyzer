// Node 18 compatibility: Mongoose 9 / mongodb driver 7 expects global crypto.getRandomValues
if (!globalThis.crypto) {
  try {
    const nodeCrypto = require('crypto');
    globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
  } catch (_) {}
}

// Ensure test secrets & fallback MONGODB_URI are set before any model/validator require
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test_placeholder';

jest.setTimeout(60000);

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Override MONGODB_URI to point to memory server
  process.env.MONGODB_URI = mongoUri;

  // Disconnect if there is a leftover connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);
