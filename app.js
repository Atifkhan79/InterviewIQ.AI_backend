import { config } from "dotenv";


config({ path: process.cwd() + "/config.env" });

import express from 'express';
import { dbConnection } from './dataBase/dbConnection.js';

import cookieParser from "cookie-parser";
import userRouter from "./routes/userroute.js";
import { errorMiddleware } from "./middleware/errorhandler.js";
import cors from "cors";
import interviewRouter from './routes/interviewroute.js';

import paymentRoutes from "./routes/paymentroutes.js";
import webhookRoutes from "./routes/webhookroutes.js";



export const app = express();


app.use(
  cors({
    origin: "http://localhost:5173 || process.env.FRONTEND_URL",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

dbConnection();

// Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/interview", interviewRouter);

//payment route
app.use("/api/v1/payment", paymentRoutes);

app.use("/api/v1/webhook", webhookRoutes);

// Error middleware — must be last
app.use(errorMiddleware);