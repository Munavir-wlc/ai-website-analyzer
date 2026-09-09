const mongoose = require('mongoose');

const ProcessedWebhookEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: [true, 'Stripe event ID is required'],
    unique: true,
    index: true
  },
  processedAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // 30-day TTL index to automatically clean up historical webhook records
  }
});

module.exports = mongoose.model('ProcessedWebhookEvent', ProcessedWebhookEventSchema);
