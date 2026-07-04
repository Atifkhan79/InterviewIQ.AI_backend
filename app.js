import { config } from "dotenv";
config({ path: process.cwd() + "/config.env" });

import express from 'express';
import { dbConnection } from './dataBase/dbConnection.js';
import cookieParser from "cookie-parser";
import userRouter from "./routes/userRoute.js";
import { errorMiddleware } from "./middleware/errorHandler.js";
import cors from "cors";
import interviewRouter from './routes/interviewRoute.js';
import paymentRoutes from "./routes/paymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Ensure DB is connected before handling any request
app.use(async (req, res, next) => {
  try {
    await dbConnection();
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

// Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/interview", interviewRouter);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/webhook", webhookRoutes);

app.use(errorMiddleware);