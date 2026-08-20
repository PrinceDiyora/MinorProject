import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import adminRouter from "./routers/admin.router.js";
import categoryRouter from "./routers/category.router.js";
import foodItemRouter from "./routers/foodItem.router.js";
import customerRouter from "./routers/customer.router.js";
import orderRouter from "./routers/order.router.js";
import recommendationRouter from "./routers/recommendation.router.js";
import pricingRouter from "./routers/pricing.router.js";
import upsellRouter from "./routers/upsell.router.js";
import voiceRouter from "./routers/voice.router.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Set-Cookie"],
  }),
);

app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/admin", adminRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/food-items", foodItemRouter);
app.use("/api/customers", customerRouter);
app.use("/api/orders", orderRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/upsell", upsellRouter);
app.use("/api/voice",  voiceRouter);     // Voice AI agent internal routes

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    statusCode,
    message,
    success: false,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

export default app;
