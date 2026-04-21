import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import DB from "./DB/db.js";
import userRoutes from "./routes/user.js";
import historyRoutes from "./routes/history.js";
import openaiRoutes from "./routes/openai.js";
import { initGoogleAuth } from "./utils/passport.js";

dotenv.config();
initGoogleAuth();
console.log(process.env.FRONTEND_URL)
const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const allowedOrigins = [...new Set(["http://localhost:5173", ...parseOrigins(process.env.FRONTEND_URL)])];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  optionsSuccessStatus: 200,
  credentials: true,
};

const app = express();

app.use(cors(corsOptions));
app.use(passport.initialize());
app.use(cookieParser());
app.use(express.json());

app.use(async (_req, res, next) => {
  try {
    await DB();
    next();
  } catch (error) {
    return res.status(500).json({ message: "Database connection failed" });
  }
});

app.use("/api/users", userRoutes);
app.use("/api/openai", openaiRoutes);
app.use("/api/history", historyRoutes);

export default app;
