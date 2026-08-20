import { Router } from "express";
import {
  getAllCategories, getCategoryById,
  createCategory, updateCategory, deleteCategory,
} from "../controllers/category.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT); // all category routes require login

router.get   ("/",    getAllCategories);
router.get   ("/:id", getCategoryById);
router.post  ("/",    createCategory);
router.patch ("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
