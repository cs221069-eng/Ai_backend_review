import express from "express";
import { reviewCode } from "../controllers/openaiCont.js";
import { protectRoute } from "../utils/auth.js";

const router = express.Router();

router.use(protectRoute);
router.post("/review", reviewCode);

export default router;
