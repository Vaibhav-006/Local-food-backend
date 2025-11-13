import cors from "cors";
import express from "express";

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const app = express();

// Middleware
app.use(cors({
    origin: "https://local-food-discovery.vercel.app",
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// MongoDB Atlas Connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
};

// Connect to MongoDB
connectDB();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const foodRoutes = require('./routes/foods');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/foods', foodRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'FoodDiscover Backend is running',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
});

// Test User model
app.get('/api/test-user', async (req, res) => {
    try {
        const User = require('./models/User');
        const count = await User.countDocuments();
        res.json({ message: 'User model working', userCount: count });
    } catch (error) {
        res.status(500).json({ message: 'User model error', error: error.message });
    }
});

// Minimal working login endpoint
app.post('/api/simple-login', async (req, res) => {
    try {
        const User = require('./models/User');
        const jwt = require('jsonwebtoken');
        const bcrypt = require('bcryptjs');
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide both email and password' });
        }
        
        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Check password directly with bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Simple login error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Serve frontend files
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, '../index.html'));
// });

// app.get('/login', (req, res) => {
//     res.sendFile(path.join(__dirname, '../login.html'));
// });

// app.get('/register', (req, res) => {
//     res.sendFile(path.join(__dirname, '../register.html'));
// });

// app.get('/dashboard', (req, res) => {
//     res.sendFile(path.join(__dirname, '../dashboard.html'));
// });

// app.get('/search', (req, res) => {
//     res.sendFile(path.join(__dirname, '../search.html'));
// });

app.get("/", (req, res) => {
  res.send("API is working!");
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 FoodDiscover Backend Server running on port ${PORT}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
});

