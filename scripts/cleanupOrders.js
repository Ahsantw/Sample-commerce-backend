const mongoose = require('mongoose');
const Order = require('../models/Order');

const cleanupOldOrders = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await Order.deleteMany({
      status: 'cancelled',
      updatedAt: { $lt: sevenDaysAgo }
    });

    console.log(`[${new Date().toISOString()}] Cleanup: Deleted ${result.deletedCount} cancelled orders older than 7 days`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

// Run cleanup if this script is executed directly
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb')
    .then(() => {
      console.log('Connected to MongoDB for cleanup');
      return cleanupOldOrders();
    })
    .then(() => {
      console.log('Cleanup completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupOldOrders;