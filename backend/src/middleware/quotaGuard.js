const User = require('../models/User');

const checkScanQuota = async (req, res, next) => {
  const enablePayments = (process.env.ENABLE_PAYMENTS === 'true');

  // If payments are disabled via feature flag, bypass quota checks for seamless testing
  if (!enablePayments) {
    return next();
  }

  // Guest users are limited to 1 scan per hour via rate limiting
  if (!req.user) {
    return next();
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    // Reset quota counter if a month has passed
    if (!user.quotaResetDate || user.quotaResetDate < oneMonthAgo) {
      user.scansCountThisMonth = 0;
      user.quotaResetDate = now;
      await user.save();
    }

    const userPlan = user.plan || 'free';
    const currentScans = user.scansCountThisMonth || 0;

    // Free plan quota enforcement (max 3 scans / month)
    if (userPlan === 'free' && currentScans >= 3) {
      return res.status(402).json({
        error: 'Monthly scan quota limit reached (3/3). Upgrade to Pro or Team plan for unlimited scans.',
        code: 'QUOTA_EXCEEDED',
        scansCountThisMonth: currentScans,
        plan: userPlan
      });
    }

    // Increment count for current scan
    user.scansCountThisMonth += 1;
    await user.save();

    next();
  } catch (err) {
    console.error('[quotaGuard] Error checking scan quota:', err);
    next(); // Fail open so users can continue if DB check encounters an unexpected error
  }
};

module.exports = { checkScanQuota };
