import { Router } from "express";
import {
  getEmployeeLoans,
  createLoan,
  getLoanById,
  updateLoanStatus,
} from "../controllers/loan.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/employee/:employeeId", getEmployeeLoans);
router.get("/:id", getLoanById);
router.post("/", authorizeRoles("super_admin", "company_admin"), createLoan);
router.patch("/:id", authorizeRoles("super_admin", "company_admin"), updateLoanStatus);

export default router;
