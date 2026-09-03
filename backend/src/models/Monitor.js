const mongoose = require('mongoose');

const MonitorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true,
    default: null
  },
  domainId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Domain',
    default: null
  },
  hostname: {
    type: String,
    required: [true, 'Hostname is required'],
    trim: true,
    lowercase: true,
    index: true
  },
  targetUrl: {
    type: String,
    required: [true, 'Target URL is required'],
    trim: true
  },
  scanMode: {
    type: String,
    enum: ['quick', 'full', 'active'],
    default: 'quick'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'weekly'
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  lastScanAt: {
    type: Date,
    default: null
  },
  lastScanId: {
    type: String,
    default: null
  },
  nextScanAt: {
    type: Date,
    required: true,
    index: true
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    onCritical: { type: Boolean, default: true },
    onHigh: { type: Boolean, default: true },
    onScoreDrop: { type: Boolean, default: true },
    scoreDropThreshold: { type: Number, default: 5 },
    onResolved: { type: Boolean, default: true },
    onFailure: { type: Boolean, default: true },
    recipients: [{ type: String, trim: true, lowercase: true }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate next run date based on frequency
MonitorSchema.methods.calculateNextRun = function(fromDate = new Date()) {
  const next = new Date(fromDate);
  if (this.frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (this.frequency === 'monthly') {
    next.setDate(next.getDate() + 30);
  } else {
    // default weekly
    next.setDate(next.getDate() + 7);
  }
  return next;
};

// Update timestamp hook
MonitorSchema.pre('save', function() {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Monitor', MonitorSchema);
