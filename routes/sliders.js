const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminAuth } = require('../middleware/auth');
const Slider = require('../models/Slider');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/sliders/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all sliders
router.get('/', async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ order: 1, createdAt: -1 });
    res.json(sliders);
  } catch (error) {
    console.error('Get sliders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active sliders for frontend
router.get('/active', async (req, res) => {
  try {
    const sliders = await Slider.find({ active: true }).sort({ order: 1 });
    res.json(sliders);
  } catch (error) {
    console.error('Get active sliders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new slider
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, buttonText, buttonLink, active, order } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const slider = new Slider({
      title,
      description,
      image: req.file.filename,
      buttonText,
      buttonLink,
      active: active === 'true',
      order: order || 0
    });

    await slider.save();
    res.status(201).json(slider);
  } catch (error) {
    console.error('Create slider error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update slider
router.put('/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, buttonText, buttonLink, active, order } = req.body;

    const updateData = {
      title,
      description,
      buttonText,
      buttonLink,
      active: active === 'true',
      order: order || 0
    };

    // If new image is uploaded, update the image field and delete old image
    if (req.file) {
      const oldSlider = await Slider.findById(id);
      if (oldSlider && oldSlider.image) {
        // Delete old image file
        const oldImagePath = `uploads/sliders/${oldSlider.image}`;
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = req.file.filename;
    }

    const slider = await Slider.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!slider) {
      return res.status(404).json({ message: 'Slider not found' });
    }

    res.json(slider);
  } catch (error) {
    console.error('Update slider error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete slider
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const slider = await Slider.findById(id);
    if (!slider) {
      return res.status(404).json({ message: 'Slider not found' });
    }

    // Delete image file
    if (slider.image) {
      const imagePath = `uploads/sliders/${slider.image}`;
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Slider.findByIdAndDelete(id);
    res.json({ message: 'Slider deleted successfully' });
  } catch (error) {
    console.error('Delete slider error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update slider order
router.patch('/:id/order', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    const slider = await Slider.findByIdAndUpdate(id, { order }, { new: true });
    
    if (!slider) {
      return res.status(404).json({ message: 'Slider not found' });
    }

    res.json(slider);
  } catch (error) {
    console.error('Update slider order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;