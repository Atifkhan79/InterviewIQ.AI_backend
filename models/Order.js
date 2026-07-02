import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        default: "pending"
    },
    stripePaymentId: {
        type: String,
        default: null
    }
}, { timestamps: true });

export const Order = mongoose.model("Order", orderSchema);