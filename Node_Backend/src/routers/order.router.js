import { Router } from "express";
import {
  getAllOrders, getOrderById,
  createOrder, updateOrderStatus, cancelOrder,
  getProfitabilityAnalytics,
} from "../controllers/order.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT);

router.get   ("/analytics/profitability", getProfitabilityAnalytics); // must be BEFORE /:id
router.get   ("/",           getAllOrders);
router.get   ("/:id",        getOrderById);
router.post  ("/",           createOrder);
router.patch ("/:id/status", updateOrderStatus);
router.delete("/:id",        cancelOrder);

export default router;
