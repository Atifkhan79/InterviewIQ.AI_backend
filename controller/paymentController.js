import Stripe from "stripe";
import { Order } from "../models/order.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// CREATE PAYMENT INTENT + ORDER
export const createPaymentIntent = async (req, res) => {
    try {
        const { amount } = req.body;

        // 1. Create order in DB first
        const order = await Order.create({
            amount,
            status: "pending"
        });

        // 2. Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            metadata: {
                orderId: order._id.toString()
            }
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            orderId: order._id
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};