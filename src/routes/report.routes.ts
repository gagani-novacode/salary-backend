import { Router } from "express";
import { generatePayslipPDF, generateSummaryExcel } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/payslip/:id/pdf", generatePayslipPDF);
router.get("/summary/excel", generateSummaryExcel);

export default router;
