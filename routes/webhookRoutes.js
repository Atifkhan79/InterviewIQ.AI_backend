import express from "express";
import Stripe from "stripe";
import { Order } from "../models/Order.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY,);

// IMPORTANT: raw body needed
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {

    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // PAYMENT SUCCESS
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;

        const orderId = paymentIntent.metadata.orderId;

        await Order.findByIdAndUpdate(orderId, {
            status: "paid",
            stripePaymentId: paymentIntent.id
        });
    }

    res.json({ received: true });
});

export default router;