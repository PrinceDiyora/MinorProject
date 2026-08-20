import { Router } from "express";
import { recommend } from "../controllers/recommendation.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT); // ensures req.admin.id is always present

// POST — accepts cart as JSON body (preferred for production)
router.post("/", recommend);

// GET  — accepts cart as comma-separated query param (handy for testing)
// Example: GET /api/recommendations?cart=1,3&limit=3
router.get("/", recommend);

export default router;

