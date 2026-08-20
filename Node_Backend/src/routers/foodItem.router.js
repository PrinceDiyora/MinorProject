import { Router } from "express";
import {
  getAllFoodItems, getFoodItemById,
  createFoodItem, updateFoodItem,
  deleteFoodItem, toggleAvailability,
} from "../controllers/foodItem.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT);

router.get   ("/",                    getAllFoodItems);
router.get   ("/:id",                 getFoodItemById);
router.post  ("/",                    createFoodItem);
router.patch ("/:id",                 updateFoodItem);
router.delete("/:id",                 deleteFoodItem);
router.patch ("/:id/toggle-availability", toggleAvailability);

export default router;
