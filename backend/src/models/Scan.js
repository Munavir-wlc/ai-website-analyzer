const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema({
  scanId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  url: {
    type: String,
    required: true
  },
  score: {
    type: Number
  },
  grade: {
    type: String
  },
  scanMode: {
    type: String
  },
  report: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null,
    index: { expiresAfterSeconds: 0 } // Expire document at the specified timestamp (null = never expire)
  }
});

module.exports = mongoose.model('Scan', ScanSchema);
