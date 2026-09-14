import { Router } from "express";
import {
  runPayrollForCompany,
  getCompanyPayrolls,
  getPayrollById,
  approvePayrollRun,
  updatePayrollOverride,
} from "../controllers/payroll.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/run", authorizeRoles("super_admin", "company_admin"), runPayrollForCompany);
router.get("/company/:companyId", getCompanyPayrolls);
router.get("/:id", getPayrollById);
router.patch("/:id/approve", authorizeRoles("super_admin", "company_admin"), approvePayrollRun);
router.patch("/:id/override", authorizeRoles("super_admin", "company_admin"), updatePayrollOverride);

export default router;
