const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Scan = require('../models/Scan');
const { protect } = require('../middleware/auth');

// JWT Token Generator Utility
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Helper to set HttpOnly Cookie and return response
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Allow top-level cross-site navigation
    path: '/'
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      },
      token
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please enter all required fields' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    if (user) {
      sendTokenResponse(user, 201, res);
    } else {
      res.status(400).json({ error: 'Invalid user data provided' });
    }
  } catch (error) {
    console.error('[Register Router Error]:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password' });
    }

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('[Login Router Error]:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// @route   POST /api/auth/logout
// @desc    Clear authentication cookie
// @access  Public
router.post('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    path: '/'
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt
    });
  } catch (error) {
    console.error('[Get Profile Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve profile details' });
  }
});

// @route   GET /api/auth/history
// @desc    Get authenticated user's scan history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    // Find all scans belonging to this user, sorted by creation date descending
    const scans = await Scan.find({ userId: req.user._id })
      .select('scanId url score grade scanMode createdAt report')
      .sort({ createdAt: -1 });

    res.json(scans);
  } catch (error) {
    console.error('[Get History Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve scan history' });
  }
});

module.exports = router;
