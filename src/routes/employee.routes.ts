import { Router } from "express";
import {
  getCompanyEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employee.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/company/:companyId", getCompanyEmployees);
router.get("/:id", getEmployeeById);
router.post("/", authorizeRoles("super_admin", "company_admin"), createEmployee);
router.patch("/:id", authorizeRoles("super_admin", "company_admin"), updateEmployee);
router.delete("/:id", authorizeRoles("super_admin", "company_admin"), deleteEmployee);

export default router;
