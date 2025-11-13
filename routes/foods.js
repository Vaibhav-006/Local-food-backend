const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const Food = require('../models/Food');
const User = require('../models/User');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

// Multer storage
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
        cb(null, `${Date.now()}_${base}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WEBP images are allowed'));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, message: 'Too many files. Maximum is 5 files.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ success: false, message: 'Unexpected field name for file upload.' });
        }
        return res.status(400).json({ success: false, message: 'File upload error: ' + err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
    }
    next();
};

// Auth middleware (same style as users route)
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated' });
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// @route   POST /api/foods
// @desc    Create a food item with image upload
// @access  Private
router.post('/', auth, (req, res, next) => {
    upload.array('images', 5)(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Request files:', req.files);
        console.log('User:', req.user);
        
        // Check if user exists and is valid
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'Invalid user session' });
        }
        
        const { title, description, cuisineType, vendorName, address, city, price, priceRange, tags } = req.body;

        // Validate required fields
        if (!title || title.trim() === '') {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        if (!description || description.trim() === '') {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }

        if (!cuisineType || cuisineType.trim() === '') {
            return res.status(400).json({ success: false, message: 'Cuisine type is required' });
        }

        if (!vendorName || vendorName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Vendor name is required' });
        }

        if (!address || address.trim() === '') {
            return res.status(400).json({ success: false, message: 'Address is required' });
        }

        if (!city || city.trim() === '') {
            return res.status(400).json({ success: false, message: 'City is required' });
        }

        if (!price || isNaN(Number(price)) || Number(price) < 0) {
            return res.status(400).json({ success: false, message: 'Valid price is required' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one image is required' });
        }

        // Validate file types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        for (const file of req.files) {
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({ success: false, message: 'Only JPEG, PNG, and WEBP images are allowed' });
            }
        }

        let normalizedTags = Array.isArray(tags)
            ? tags
            : (typeof tags === 'string' && tags.length ? tags.split(',').map(t => t.trim()) : []);
        normalizedTags = normalizedTags.filter(Boolean).slice(0, 10);

        const images = req.files.map(f => `/uploads/${f.filename}`);

        const dietary = {
            vegetarian: req.body.vegetarian === 'true' || req.body.vegetarian === true,
            vegan: req.body.vegan === 'true' || req.body.vegan === true,
            glutenfree: req.body.glutenfree === 'true' || req.body.glutenfree === true,
            halal: req.body.halal === 'true' || req.body.halal === true,
            kosher: req.body.kosher === 'true' || req.body.kosher === true
        };

        const nutrition = {
            calories: req.body.calories ? Number(req.body.calories) : undefined,
            protein: req.body.protein ? Number(req.body.protein) : undefined,
            carbs: req.body.carbs ? Number(req.body.carbs) : undefined,
            fat: req.body.fat ? Number(req.body.fat) : undefined,
            fiber: req.body.fiber ? Number(req.body.fiber) : undefined
        };

        // Coerce priceRange to allowed enum
        const allowedRanges = ['₹', '₹₹', '₹₹₹', '₹₹₹₹'];
        const safePriceRange = allowedRanges.includes(priceRange) ? priceRange : '₹₹';

        console.log('Creating food with data:', {
            title,
            description,
            cuisineType,
            vendorName,
            address,
            city,
            price: Number(price),
            priceRange: safePriceRange,
            tags: normalizedTags,
            images,
            dietary,
            nutrition,
            createdBy: req.user._id
        });

        const food = await Food.create({
            title: title.trim(),
            description: description.trim(),
            cuisineType: cuisineType.trim(),
            vendorName: vendorName.trim(),
            address: address.trim(),
            city: city.trim(),
            price: Number(price),
            priceRange: safePriceRange,
            tags: normalizedTags,
            images,
            dietary,
            nutrition,
            createdBy: req.user._id
        });

        console.log('Food created successfully:', food._id);
        res.status(201).json({ success: true, message: 'Food created successfully', food });
    } catch (error) {
        console.error('Create food error:', error);
        console.error('Error stack:', error.stack);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid value for ${error.path}` });
        }
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Duplicate entry found' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// @route   GET /api/foods/test
// @desc    Test endpoint to verify server is working
// @access  Public
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Foods route is working', timestamp: new Date().toISOString() });
});

// @route   DELETE /api/foods/:id
// @desc    Delete a food item
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        
        if (!food) {
            return res.status(404).json({ success: false, message: 'Food item not found' });
        }

        // Check if user owns this food item
        if (food.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this food item' });
        }

        await Food.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Food item deleted successfully' });
    } catch (error) {
        console.error('Delete food error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/foods
// @desc    List foods (latest first)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const foods = await Food.find().sort({ createdAt: -1 }).limit(50).lean();
        res.json({ success: true, foods });
    } catch (error) {
        console.error('List foods error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;


