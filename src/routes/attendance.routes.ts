import { Router } from "express";
import multer from "multer";
import {
  uploadAttendanceExcel,
  getCompanyAttendance,
  getEmployeeAttendance,
  deleteAttendanceRecord,
} from "../controllers/attendance.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

router.post(
  "/upload",
  authorizeRoles("super_admin", "company_admin"),
  upload.single("file"),
  uploadAttendanceExcel
);

router.get("/company/:companyId", getCompanyAttendance);
router.get("/employee/:employeeId/:month/:year", getEmployeeAttendance);
router.delete("/:id", authenticate, deleteAttendanceRecord);

export default router;
