import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import companyRoutes from "./routes/company.routes";
import employeeRoutes from "./routes/employee.routes";
import holidayRoutes from "./routes/holiday.routes";
import loanRoutes from "./routes/loan.routes";
import attendanceRoutes from "./routes/attendance.routes";
import payrollRoutes from "./routes/payroll.routes";
import reportRoutes from "./routes/report.routes";
import { errorHandler } from "./middleware/error.middleware";

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect DB
connectDB();

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/reports", reportRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Salary Management System API is running smoothly", timestamp: new Date() });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[API Server] Listening on http://localhost:${PORT}`);
});
