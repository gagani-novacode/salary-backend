import { Router } from "express";
import {
  getPublicCompanies,
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../controllers/company.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.get("/public", getPublicCompanies);

router.use(authenticate);

router.get("/", getCompanies);
router.get("/:id", getCompanyById);
router.post("/", authorizeRoles("super_admin"), createCompany);
router.patch("/:id", authorizeRoles("super_admin", "company_admin"), updateCompany);
router.delete("/:id", authorizeRoles("super_admin"), deleteCompany);

export default router;
