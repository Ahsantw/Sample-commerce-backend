const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const router = express.Router();

// Create new order
router.post('/', auth, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod = 'cash_on_delivery' } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Check stock availability and calculate total
    let total = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      
      if (!product) {
        return res.status(404).json({ message: `Product ${item.product.name} not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }

      total += item.product.price * item.quantity;
      
      orderItems.push({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        name: item.product.name
      });
    }

    // Create order
    const order = new Order({
      user: req.user.id,
      items: orderItems,
      total,
      shippingAddress,
      paymentMethod
    });

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Save order
    await order.save();
    await order.populate('user', 'username email');

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'username email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns the order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status (admin only) - PREVENT REVERSING CANCELLED ORDERS
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Prevent changing status of cancelled orders
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot update status of a cancelled order' });
    }

    // If changing to cancelled, restore product stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }
    }

    // If changing from cancelled to another status, check stock availability
    if (order.status === 'cancelled' && status !== 'cancelled') {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product.stock < item.quantity) {
          return res.status(400).json({ 
            message: `Not enough stock for ${product.name}. Available: ${product.stock}, Required: ${item.quantity}` 
          });
        }
      }
      
      // Deduct stock again if moving from cancelled to active status
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity } }
        );
      }
    }

    order.status = status;
    await order.save();
    await order.populate('user', 'username email');

    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel order (user only)
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns the order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only allow cancellation for pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    order.status = 'cancelled';
    await order.save();

    res.json(order);
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin cancel order (can cancel any order except delivered)
router.patch('/:id/admin-cancel', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Prevent cancelling delivered orders
    if (order.status === 'delivered') {
      return res.status(400).json({ message: 'Cannot cancel a delivered order' });
    }

    // Prevent cancelling already cancelled orders
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    order.status = 'cancelled';
    await order.save();
    await order.populate('user', 'username email');

    res.json(order);
  } catch (error) {
    console.error('Admin cancel order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get order statistics (admin only)
router.get('/stats/overview', adminAuth, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const recentOrders = await Order.find()
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalOrders,
      pendingOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      recentOrders
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Auto-delete cancelled orders older than 7 days
router.delete('/cleanup', adminAuth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await Order.deleteMany({
      status: 'cancelled',
      updatedAt: { $lt: sevenDaysAgo }
    });

    res.json({
      message: `Deleted ${result.deletedCount} cancelled orders older than 7 days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;