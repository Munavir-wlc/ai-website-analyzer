const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vapt_scanner_jwt_secret_token_key_2026_xyz');

      // Get user from the token and attach to request
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      console.error('[Auth Middleware Error]:', error);
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vapt_scanner_jwt_secret_token_key_2026_xyz');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Don't fail the request, just log and proceed without req.user
      console.warn('[Optional Auth Middleware]: Invalid or expired token ignored.');
    }
  }
  next();
};

module.exports = { protect, optionalAuth };
