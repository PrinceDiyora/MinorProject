import { Router } from "express";
import { dynamicPrice, strategicPrice, getSuggestions } from "../controllers/pricing.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT);

router.get("/suggestions", getSuggestions);  // Engine 3 — all items
router.post("/dynamic", dynamicPrice);    // Engine 1
router.post("/optimize", strategicPrice);  // Engine 3 — single item

export default router;
