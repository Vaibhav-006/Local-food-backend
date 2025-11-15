const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Food title is required'],
        trim: true,
        maxlength: [120, 'Title cannot exceed 120 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    cuisineType: {
        type: String,
        trim: true,
        maxlength: [60, 'Cuisine type cannot exceed 60 characters']
    },
    vendorName: {
        type: String,
        required: [true, 'Vendor name is required'],
        trim: true,
        maxlength: [100, 'Vendor name cannot exceed 100 characters']
    },
    address: {
        type: String,
        trim: true,
        maxlength: [200, 'Address cannot exceed 200 characters']
    },
    city: {
        type: String,
        trim: true,
        maxlength: [100, 'City cannot exceed 100 characters']
    },
    price: {
        type: Number,
        min: [0, 'Price cannot be negative']
    },
    priceRange: {
        type: String,
        enum: ['₹', '₹₹', '₹₹₹', '₹₹₹₹'],
        default: '₹₹'
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 30
    }],
    images: [{ type: String }],
    dietary: {
        vegetarian: { type: Boolean, default: false },
        vegan: { type: Boolean, default: false },
        glutenfree: { type: Boolean, default: false },
        halal: { type: Boolean, default: false },
        kosher: { type: Boolean, default: false }
    },
    nutrition: {
        calories: { type: Number, min: 0 },
        protein: { type: Number, min: 0 },
        carbs: { type: Number, min: 0 },
        fat: { type: Number, min: 0 },
        fiber: { type: Number, min: 0 }
    },
    rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0, min: 0 }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

foodSchema.index({ createdAt: -1 });
foodSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Food', foodSchema);


