const mongoose = require('mongoose');

const DomainSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hostname: {
    type: String,
    required: [true, 'Hostname is required'],
    trim: true,
    lowercase: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  verificationMethod: {
    type: String,
    enum: ['dns-txt', 'file-upload', null],
    default: null
  },
  verificationToken: {
    type: String,
    required: true
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a user can only add a specific hostname once
DomainSchema.index({ userId: 1, hostname: 1 }, { unique: true });

module.exports = mongoose.model('Domain', DomainSchema);
