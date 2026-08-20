import { Router } from "express";
import {
  getAllCustomers, getCustomerById,
  createCustomer, updateCustomer,
  deleteCustomer, getCustomerOrders,
} from "../controllers/customer.controller.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT);

router.get   ("/",          getAllCustomers);
router.get   ("/:id",       getCustomerById);
router.post  ("/",          createCustomer);
router.patch ("/:id",       updateCustomer);
router.delete("/:id",       deleteCustomer);
router.get   ("/:id/orders", getCustomerOrders);

export default router;
