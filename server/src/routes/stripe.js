const express = require("express");
const Stripe = require("stripe");
const User = require("../../models/user");
const { jwtCheck } = require("../middleware/auth");

const router = express.Router();

const getPriceId       = () => process.env.STRIPE_PRICE_ID;
const getWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET;

// Lazy — avoids crashing the server on startup when keys aren't set yet.
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
const CLIENT_URL     = process.env.CLIENT_URL || "http://localhost:5173";

// POST /api/stripe/create-checkout-session
// Creates a Stripe Checkout session and returns the URL to redirect the user to.
router.post("/create-checkout-session", jwtCheck, async (req, res) => {
  try {
    const sub   = req.auth.payload.sub;
    const email = req.auth.payload.email || "";

    // Reuse existing Stripe customer if we already have one
    let user = await User.findOne({ sub });
    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({ email, metadata: { sub } });
      customerId = customer.id;
      await User.findOneAndUpdate({ sub }, { stripeCustomerId: customerId }, { upsert: true });
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: getPriceId(), quantity: 1 }],
      success_url: `${CLIENT_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${CLIENT_URL}/upgrade/cancel`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// POST /api/stripe/create-portal-session
// Redirects the user to the Stripe billing portal to manage/cancel their subscription.
router.post("/create-portal-session", jwtCheck, async (req, res) => {
  try {
    const sub  = req.auth.payload.sub;
    const user = await User.findOne({ sub });

    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found." });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: `${CLIENT_URL}/account`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err.message);
    res.status(500).json({ error: "Failed to open billing portal." });
  }
});

// POST /api/stripe/webhook
// Stripe sends signed events here. Must be registered in the Stripe dashboard.
// Use raw body (express.raw) — do NOT run express.json() on this route.
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, getWebhookSecret());
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription") {
          await User.findOneAndUpdate(
            { stripeCustomerId: session.customer },
            {
              subscriptionId:     session.subscription,
              subscriptionStatus: "active",
            }
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        await User.findOneAndUpdate(
          { stripeCustomerId: sub.customer },
          {
            subscriptionId:     sub.id,
            subscriptionStatus: sub.status, // 'active', 'past_due', 'canceled', etc.
          }
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await User.findOneAndUpdate(
          { stripeCustomerId: sub.customer },
          {
            subscriptionId:     null,
            subscriptionStatus: "canceled",
          }
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await User.findOneAndUpdate(
          { stripeCustomerId: invoice.customer },
          { subscriptionStatus: "past_due" }
        );
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    // Still return 200 so Stripe doesn't retry indefinitely
  }

  res.json({ received: true });
});

module.exports = router;
