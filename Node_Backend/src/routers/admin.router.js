import { Router } from "express";
import {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  refreshAccessToken,
} from "../controllers/admin.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/register",      registerAdmin);
router.post("/login",         loginAdmin);
router.post("/refresh-token", refreshAccessToken);

// ── Protected routes (require valid JWT) ─────────────────────────────────────
router.use(verifyAdminJWT);

router.post  ("/logout",          logoutAdmin);
router.get   ("/profile",         getAdminProfile);
router.patch ("/profile",         updateAdminProfile);
router.patch ("/change-password", changeAdminPassword);

export default router;
