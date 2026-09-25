import { Router } from "express";
import { generatePayslipPDF, generateSummaryExcel, generateEPFCForm, generateEPFCFormExcel } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/payslip/:id/pdf", generatePayslipPDF);
router.get("/summary/excel", generateSummaryExcel);
router.get("/epf-c-form", generateEPFCForm);           // PDF via Puppeteer
router.get("/epf-c-form/excel", generateEPFCFormExcel); // Excel template fill

export default router;
