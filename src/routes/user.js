import express from "express";
import passport from "passport";
import userController from "../controllers/userCont.js";
import generateToken from "../utils/token.js";
import { protectRoute } from "../utils/auth.js";

const router = express.Router();
const frontendAppUrl =
  process.env.FRONTEND_APP_URL ||
  process.env.FRONTEND_URL?.split(",")[0]?.trim() ||
  "http://localhost:5173";

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/logout", protectRoute, userController.logoutUser);
router.get("/me", protectRoute, userController.getCurrentUser);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    generateToken(req.user, res);
    return res.redirect(`${frontendAppUrl.replace(/\/$/, "")}/coding`);
  }
);

export default router;
