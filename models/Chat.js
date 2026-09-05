const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  senderId: {
    type: String,
    required: true
  },
  senderEmail: {
    type: String,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  conversationId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Auto-delete messages older than 7 days
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('Message', messageSchema);