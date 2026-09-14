import { Router } from "express";
import { getHolidays, createHoliday, deleteHoliday } from "../controllers/holiday.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getHolidays);
router.post("/", authorizeRoles("super_admin", "company_admin"), createHoliday);
router.delete("/:id", authorizeRoles("super_admin", "company_admin"), deleteHoliday);

export default router;
