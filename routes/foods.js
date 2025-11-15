const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const jwt = require('jsonwebtoken');
const Food = require('../models/Food');
const User = require('../models/User');

const router = express.Router();

// Configure Cloudinary for production
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary credentials not configured!');
    console.error('Image uploads will fail. Please add the following to config.env:');
    console.error('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.error('  CLOUDINARY_API_KEY=your_api_key');
    console.error('  CLOUDINARY_API_SECRET=your_api_secret');
} else {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true // Force HTTPS for production
    });
    console.log('✅ Cloudinary configured successfully');
    console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY.substring(0, 8)}...`);
}

// Cloudinary storage configuration for production
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Generate unique filename for Cloudinary
        const timestamp = Date.now();
        const sanitizedName = file.originalname
            .replace(/[^a-z0-9._-]/gi, '_')
            .replace(/\.[^/.]+$/, ''); // Remove extension
        
        return {
            folder: 'fooddiscover', // Folder name in Cloudinary
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }], // Optimize images
            resource_type: 'image',
            public_id: `${timestamp}_${sanitizedName}`,
            use_filename: false, // Don't use original filename
            unique_filename: true, // Ensure unique filenames
            overwrite: false // Don't overwrite existing files
        };
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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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

        // Check Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return res.status(500).json({ 
                success: false, 
                message: 'Cloudinary is not configured. Please contact administrator.' 
            });
        }

        let normalizedTags = Array.isArray(tags)
            ? tags
            : (typeof tags === 'string' && tags.length ? tags.split(',').map(t => t.trim()) : []);
        normalizedTags = normalizedTags.filter(Boolean).slice(0, 10);

        // Extract Cloudinary URLs from uploaded files
        // multer-storage-cloudinary returns the Cloudinary response in file.path (secure_url)
        const images = req.files.map((file, index) => {
            try {
                // multer-storage-cloudinary stores the secure_url in file.path
                // This is the HTTPS URL that works in production
                if (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://'))) {
                    console.log(`Image ${index + 1} uploaded to Cloudinary:`, file.path);
                    return file.path;
                }
                
                // If path exists but doesn't start with http, it might be a public_id
                // Construct the full Cloudinary URL
                if (file.path) {
                    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                    // Check if it's already a public_id (no http/https)
                    if (!file.path.startsWith('http')) {
                        const url = `https://res.cloudinary.com/${cloudName}/image/upload/fooddiscover/${file.path}`;
                        console.log(`Constructed Cloudinary URL for image ${index + 1}:`, url);
                        return url;
                    }
                    return file.path;
                }
                
                // Fallback: Check for secure_url in nested response (some versions)
                if (file.secure_url) {
                    console.log(`Using secure_url for image ${index + 1}:`, file.secure_url);
                    return file.secure_url;
                }
                
                // Fallback: Check for url
                if (file.url) {
                    console.log(`Using url for image ${index + 1}:`, file.url);
                    return file.url;
                }
                
                // Last resort: try to construct from public_id or filename
                const publicId = file.public_id || file.filename;
                if (publicId) {
                    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                    const url = `https://res.cloudinary.com/${cloudName}/image/upload/fooddiscover/${publicId}`;
                    console.log(`Constructed URL from public_id for image ${index + 1}:`, url);
                    return url;
                }
                
                console.error(`No valid URL found for file ${index + 1}:`, JSON.stringify(file, null, 2));
                return null;
            } catch (error) {
                console.error(`Error processing file ${index + 1}:`, error);
                return null;
            }
        }).filter(Boolean); // Remove any null values

        // Validate that we got valid image URLs
        if (images.length === 0) {
            console.error('No valid image URLs extracted from uploaded files');
            console.error('Files received:', req.files);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to upload images to Cloudinary. Please check your Cloudinary configuration and try again.' 
            });
        }
        
        // Validate all URLs are HTTPS (required for production)
        const invalidUrls = images.filter(url => !url.startsWith('https://'));
        if (invalidUrls.length > 0) {
            console.warn('Some image URLs are not HTTPS:', invalidUrls);
        }
        
        console.log(`Successfully uploaded ${images.length} image(s) to Cloudinary:`, images);

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

// @route   GET /api/foods/test
// @desc    Test endpoint to verify server is working
// @access  Public
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Foods route is working', timestamp: new Date().toISOString() });
});

// @route   GET /api/foods/:id
// @desc    Get a single food item by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        // Skip if it's the test route
        if (req.params.id === 'test') {
            return res.json({ success: true, message: 'Foods route is working', timestamp: new Date().toISOString() });
        }
        
        const food = await Food.findById(req.params.id).lean();
        
        if (!food) {
            return res.status(404).json({ success: false, message: 'Food item not found' });
        }
        
        res.json({ success: true, food });
    } catch (error) {
        console.error('Get food error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid food ID' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
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

module.exports = router;


