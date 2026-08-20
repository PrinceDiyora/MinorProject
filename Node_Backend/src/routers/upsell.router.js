import { Router } from "express";
import { suggestUpsell } from "../controllers/upsell.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT);

router.post("/", suggestUpsell);   // Engine 2

export default router;
