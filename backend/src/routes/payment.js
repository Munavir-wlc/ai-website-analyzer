const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ProcessedWebhookEvent = require('../models/ProcessedWebhookEvent');
const { protect } = require('../middleware/auth');

// Configuration map linking Stripe Price IDs to internal plan tiers
const getPriceToPlanMap = () => {
  const map = {};
  const proPrice = process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRO_PRICE_ID;
  const teamPrice = process.env.STRIPE_PRICE_TEAM || process.env.STRIPE_TEAM_PRICE_ID;

  if (proPrice) map[proPrice] = 'pro';
  if (teamPrice) map[teamPrice] = 'team';

  // Fallback defaults for standard pricing configurations
  map['price_pro_monthly_29'] = 'pro';
  map['price_team_monthly_99'] = 'team';

  return map;
};

// Helper to determine plan tier from Stripe Price ID
function resolvePlanFromPriceId(priceId) {
  const priceMap = getPriceToPlanMap();
  if (priceId && priceMap[priceId]) {
    return priceMap[priceId];
  }
  console.warn(`[Stripe Webhook] Unrecognized or missing price ID (${priceId}). Defaulting to 'pro' plan.`);
  return 'pro';
}

// @route   GET /api/payment/subscription
// @desc    Get user's current subscription status and scan quota usage
// @access  Private
router.get('/subscription', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('plan subscriptionStatus scansCountThisMonth quotaResetDate stripeCustomerId');
    const enablePayments = (process.env.ENABLE_PAYMENTS === 'true');

    res.json({
      enablePayments,
      plan: user.plan || 'free',
      subscriptionStatus: user.subscriptionStatus || 'active',
      scansCountThisMonth: user.scansCountThisMonth || 0,
      scansLimit: user.plan === 'free' ? 3 : 'unlimited',
      quotaResetDate: user.quotaResetDate,
      hasStripeCustomer: !!user.stripeCustomerId
    });
  } catch (err) {
    console.error('[Subscription Status Error]:', err);
    res.status(500).json({ error: 'Failed to retrieve subscription status' });
  }
});

// @route   POST /api/payment/create-checkout-session
// @desc    Create a Stripe Checkout Session for Pro ($29/mo) or Team ($99/mo)
// @access  Private
router.post('/create-checkout-session', protect, async (req, res) => {
  const { plan } = req.body; // 'pro' or 'team'
  const validPlans = ['pro', 'team'];

  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected. Must be pro or team.' });
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // Fallback mode for testing when Stripe API key is not configured or ENABLE_PAYMENTS is false
    if (!stripeSecretKey || stripeSecretKey.trim() === '' || process.env.ENABLE_PAYMENTS !== 'true') {
      console.log(`[Payment Router] Simulating subscription upgrade for user ${req.user._id} to plan: ${plan}`);
      
      // Auto-upgrade user plan in test environment
      await User.findByIdAndUpdate(req.user._id, {
        plan,
        subscriptionStatus: 'active',
        scansCountThisMonth: 0
      });

      return res.json({
        success: true,
        testMode: true,
        message: `Plan upgraded to ${plan.toUpperCase()} (Test Mode)`,
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?upgraded=true`
      });
    }

    // Stripe SDK Integration
    const stripe = require('stripe')(stripeSecretKey);
    const priceId = plan === 'pro'
      ? (process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly_29')
      : (process.env.STRIPE_PRICE_TEAM || process.env.STRIPE_TEAM_PRICE_ID || 'price_team_monthly_99');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: req.user.email,
      client_reference_id: req.user._id.toString(),
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing`
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('[Checkout Session Error]:', err);
    res.status(500).json({ error: 'Failed to create payment checkout session' });
  }
});

// @route   POST /api/payment/webhook
// @desc    Stripe Webhook listener for subscription events with idempotency & price ID mapping
// @access  Public (Stripe Signature Verified)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return res.status(400).send('Webhook secret or signature missing');
  }

  let event;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const rawPayload = Buffer.isBuffer(req.body) ? req.body : (req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));
    event = stripe.webhooks.constructEvent(rawPayload, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook Signature Error]:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency Check: Verify if event has already been processed
  const alreadyProcessed = await ProcessedWebhookEvent.findOne({ eventId: event.id });
  if (alreadyProcessed) {
    console.log(`[Stripe Webhook] Duplicate event ${event.id} received. Skipping reprocessing.`);
    return res.json({ received: true, duplicate: true });
  }

  try {
    // Handle Stripe Event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;

        if (userId) {
          // Extract price ID from session or expand line_items if not present
          let priceId = session.line_items?.data?.[0]?.price?.id || session.priceId;

          if (!priceId && session.id && process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('mock')) {
            try {
              const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
              const retrievedSession = await stripe.checkout.sessions.retrieve(session.id, {
                expand: ['line_items']
              });
              priceId = retrievedSession?.line_items?.data?.[0]?.price?.id;
            } catch (retrieveErr) {
              console.warn('[Stripe Webhook] Could not expand line_items for session:', retrieveErr.message);
            }
          }

          const targetPlan = resolvePlanFromPriceId(priceId);

          await User.findByIdAndUpdate(userId, {
            plan: targetPlan,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active',
            scansCountThisMonth: 0
          });
          console.log(`[Stripe Webhook] Upgraded user ${userId} to active '${targetPlan}' subscription (Price: ${priceId || 'default'}).`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await User.findOneAndUpdate({ stripeSubscriptionId: subscription.id }, {
          plan: 'free',
          subscriptionStatus: 'canceled'
        });
        console.log(`[Stripe Webhook] Subscription ${subscription.id} canceled. Downgraded to free.`);
        break;
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type ${event.type}`);
    }

    // Save ProcessedWebhookEvent record AFTER successful processing for idempotency
    await ProcessedWebhookEvent.create({ eventId: event.id }).catch(err => {
      console.warn(`[Stripe Webhook] ProcessedWebhookEvent record creation note: ${err.message}`);
    });

    res.json({ received: true });
  } catch (processErr) {
    console.error(`[Stripe Webhook Processing Error]:`, processErr);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
