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

const corsOptions = {
  origin: "http://localhost:5173",
  optionsSuccessStatus: 200,
  credentials: true,
};

const app = express();

app.use(cors(corsOptions));
app.use(passport.initialize());
app.use(cookieParser());
app.use(express.json());

DB();

app.use("/api/users", userRoutes);
app.use("/api/openai", openaiRoutes);
app.use("/api/history", historyRoutes);

export default app;
