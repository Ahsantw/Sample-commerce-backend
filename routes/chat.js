const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const Message = require('../models/Message');

const router = express.Router();

// Get conversations for admin
router.get('/conversations', adminAuth, async (req, res) => {
  try {
    // Get unique conversations with latest message
    const conversations = await Message.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 });

    // Check if user has access to this conversation
    if (messages.length > 0) {
      const firstMessage = messages[0];
      const isParticipant = firstMessage.senderId === userId || 
                           firstMessage.conversationId === userId ||
                           req.user.role === 'admin';
      
      if (!isParticipant) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message
router.post('/message', auth, async (req, res) => {
  try {
    const { text, conversationId, isAdminReply = false } = req.body;
    const userId = req.user._id.toString();

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const message = new Message({
      text: text.trim(),
      senderId: userId,
      senderEmail: req.user.email,
      senderName: req.user.username,
      isAdmin: isAdminReply || req.user.role === 'admin',
      conversationId: conversationId || userId,
      messageType: 'chat'
    });

    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message as guest (no auth required) - Updated for contact forms
router.post('/guest-message', async (req, res) => {
  try {
    const { text, guestName, guestEmail, isContactForm = false, subject } = req.body;

    if (!text || !text.trim() || !guestName || !guestEmail) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const conversationId = isContactForm ? `contact-${guestEmail}-${Date.now()}` : `guest-${guestEmail}`;

    const messageData = {
      text: text.trim(),
      senderId: 'guest',
      senderEmail: guestEmail,
      senderName: guestName,
      isAdmin: false,
      conversationId,
      messageType: isContactForm ? 'contact_form' : 'chat'
    };

    // Add contact form data if it's a contact form message
    if (isContactForm && subject) {
      messageData.contactFormData = {
        subject: subject,
        originalMessage: text.trim()
      };
      // For contact forms, use a shorter preview text
      messageData.text = `Contact: ${subject}`;
    }

    const message = new Message(messageData);
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.error('Guest message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get guest messages
router.get('/guest-conversation/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const conversationId = `guest-${email}`;

    const messages = await Message.find({ 
      $or: [
        { conversationId },
        { senderEmail: email, messageType: 'contact_form' }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Get guest messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete conversation (admin only)
router.delete('/conversation/:conversationId', adminAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.deleteMany({ conversationId });
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;