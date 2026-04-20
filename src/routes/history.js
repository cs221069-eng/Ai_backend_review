import express from "express";
import { getHistoryById, getHistoryList } from "../controllers/historyCont.js";
import { protectRoute } from "../utils/auth.js";

const router = express.Router();

router.use(protectRoute);
router.get("/", getHistoryList);
router.get("/:id", getHistoryById);

export default router;
