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
    // Find personal scans belonging strictly to this user (excluding team workspace scans)
    const scans = await Scan.find({
      userId: req.user._id,
      $or: [{ teamId: null }, { teamId: { $exists: false } }]
    })
      .select('scanId url score grade scanMode createdAt report')
      .sort({ createdAt: -1 });

    res.json(scans);
  } catch (error) {
    console.error('[Get History Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve scan history' });
  }
});

const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

// @route   POST /api/auth/forgot-password
// @desc    Generate password reset token and send email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ error: 'Please enter your registered email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Return 200 for security so attackers cannot enumerate valid user emails
      return res.json({
        success: true,
        message: 'If an account exists with that email, password reset instructions have been sent.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const emailResult = await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetLink
    });

    const responsePayload = {
      success: true,
      message: 'Password reset instructions have been sent to your email address.',
      emailSent: emailResult.success
    };

    if (process.env.NODE_ENV !== 'production') {
      responsePayload.previewUrl = emailResult.previewUrl || null;
      responsePayload.resetToken = resetToken;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('[Forgot Password Error]:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using valid reset token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('[Reset Password Error]:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
