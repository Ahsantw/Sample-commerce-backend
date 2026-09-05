const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['buyer', 'admin'],
    default: 'buyer'
  }
}, {
  timestamps: true
});

// Create admin user if it doesn't exist
userSchema.statics.initAdmin = async function() {
  try {
    const adminExists = await this.findOne({ username: 'admin' });
    if (!adminExists) {
      // Hash the admin password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin1234', salt);
      
      await this.create({
        username: 'admin',
        email: 'admin@store.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('✅ Admin user created successfully');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
};

module.exports = mongoose.model('User', userSchema);