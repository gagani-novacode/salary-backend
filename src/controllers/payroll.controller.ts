import { Response } from "express";
import { PayrollRun } from "../models/PayrollRun";
import { Employee } from "../models/Employee";
import { Attendance } from "../models/Attendance";
import { Loan } from "../models/Loan";
import { Holiday } from "../models/Holiday";
import { Company } from "../models/Company";
import { calculateEmployeeSalary } from "../engine/salary_engine";
import { AuthRequest } from "../middleware/auth.middleware";

export const runPayrollForCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId, month, year, overrides } = req.body;
    if (!companyId || !month || !year) {
      res.status(400).json({ success: false, message: "Company ID, month, and year are required" });
      return;
    }

    const company = await Company.findById(companyId);
    if (!company) {
      res.status(404).json({ success: false, message: "Company not found" });
      return;
    }

    // Get company holidays
    const holidays = await Holiday.find({ companyId });
    const holidayDatesSet = new Set(holidays.map((h) => h.date));

    // Get active employees
    const employees = await Employee.find({ companyId, status: "active" });
    if (employees.length === 0) {
      res.status(400).json({ success: false, message: "No active employees found for this company" });
      return;
    }

    const payrollResults = [];

    for (const emp of employees) {
      const attendance = await Attendance.findOne({
        companyId,
        employeeId: emp._id,
        month: Number(month),
        year: Number(year),
      });

      const records = attendance ? attendance.records : [];

      const activeLoans = await Loan.find({
        employeeId: emp._id,
        status: "active",
      });

      const empOverride = (overrides && overrides[emp._id.toString()]) || {};

      const prevMonth = Number(month) === 1 ? 12 : Number(month) - 1;
      const prevYear = Number(month) === 1 ? Number(year) - 1 : Number(year);

      const prevPayroll = await PayrollRun.findOne({
        companyId,
        employeeId: emp._id,
        month: prevMonth,
        year: prevYear,
      });

      const totalUsedLeavesPrevious = prevPayroll?.usedLeavesTotal ?? 0;

      const result = calculateEmployeeSalary({
        employee: emp,
        attendanceRecords: records,
        activeLoans,
        workingDaysInMonth: company.workingDaysPerMonth || 26,
        incentive: Number(empOverride.incentive || 0),
        commissionSales: Number(empOverride.commissionSales || 0),
        advanceDeduction: Number(empOverride.advanceDeduction || 0),
        totalUsedLeavesPrevious,
        companyHolidaysSet: holidayDatesSet,
      });

      const payrollRun = await PayrollRun.findOneAndUpdate(
        { companyId, employeeId: emp._id, month: Number(month), year: Number(year) },
        {
          companyId,
          employeeId: emp._id,
          month: Number(month),
          year: Number(year),
          employeeNo: emp.employeeNo,
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,

          entitledHolidays: result.entitledHolidays,
          usedLeavesTotal: result.totalUsedLeaves,
          usedLeavesThisMonth: result.usedLeavesThisMonth,
          noPayDays: result.noPayDays,
          weekdays: result.weekdays,
          poyaDays: result.poyaDays,
          sundays: result.sundays,
          publicHolidays: result.publicHolidays,
          workingDaysInMonth: result.workingDaysInMonth,

          basicSalary: result.basicSalary,
          holidayWages: result.holidayWages,
          normalOTHours: result.normalOTHours,
          normalOTAmount: result.normalOTAmount,
          doubleOTHours: result.doubleOTHours,
          doubleOTAmount: result.doubleOTAmount,
          salaryForEPF: result.salaryForEPF,
          attendanceAllowance: result.attendanceAllowance,
          incentive: result.incentive,
          commissionSales: result.commissionSales,
          grossSalary: result.grossSalary,

          epfEmployee8: result.epfEmployee8,
          loanDeductions: result.loanDeductions,
          advanceDeduction: result.advanceDeduction,
          noPayAmount: result.noPayAmount,
          totalDeductions: result.totalDeductions,

          epfEmployer12: result.epfEmployer12,
          etf3: result.etf3,

          netPay: result.netPay,
          status: "draft",
        },
        { upsert: true, new: true }
      );

      payrollResults.push(payrollRun);
    }

    res.json({
      success: true,
      message: `Payroll processed for ${payrollResults.length} employees`,
      count: payrollResults.length,
      data: payrollResults,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyPayrolls = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId } = req.params;
    const { month, year } = req.query;

    const filter: any = { companyId };
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);

    const payrolls = await PayrollRun.find(filter).sort({ employeeNo: 1 });
    res.json({ success: true, count: payrolls.length, data: payrolls });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPayrollById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payroll = await PayrollRun.findById(id).populate("companyId", "name branchLocation epfRegNo etfRegNo");
    if (!payroll) {
      res.status(404).json({ success: false, message: "Payroll run not found" });
      return;
    }
    res.json({ success: true, data: payroll });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approvePayrollRun = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payroll = await PayrollRun.findById(id);
    if (!payroll) {
      res.status(404).json({ success: false, message: "Payroll run not found" });
      return;
    }

    if (payroll.status === "approved" || payroll.status === "paid") {
      res.status(400).json({ success: false, message: "Payroll run already approved" });
      return;
    }

    payroll.status = "approved";
    payroll.approvedBy = req.user?._id;
    payroll.approvedAt = new Date();
    await payroll.save();

    // Deduct loan repayments if loan deductions exist
    if (payroll.loanDeductions > 0) {
      const activeLoans = await Loan.find({ employeeId: payroll.employeeId, status: "active" });
      let remainingDeduction = payroll.loanDeductions;

      for (const loan of activeLoans) {
        if (remainingDeduction <= 0) break;
        const deductAmt = Math.min(loan.monthlyInstalment, loan.balance, remainingDeduction);
        if (deductAmt > 0) {
          const balanceBefore = loan.balance;
          loan.balance -= deductAmt;
          if (loan.balance <= 0) {
            loan.balance = 0;
            loan.status = "settled";
          }
          loan.repayments.push({
            month: payroll.month,
            year: payroll.year,
            amountDeducted: deductAmt,
            balanceBefore,
            balanceAfter: loan.balance,
            payrollRunId: payroll._id,
            date: new Date(),
          });
          await loan.save();
          remainingDeduction -= deductAmt;
        }
      }
    }

    res.json({ success: true, message: "Payroll run approved successfully", data: payroll });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePayrollOverride = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { incentive, commissionSales, advanceDeduction } = req.body;

    const payroll = await PayrollRun.findById(id);
    if (!payroll) {
      res.status(404).json({ success: false, message: "Payroll run not found" });
      return;
    }

    if (payroll.status === "approved") {
      res.status(400).json({ success: false, message: "Cannot edit an approved payroll run" });
      return;
    }

    if (incentive !== undefined) payroll.incentive = Number(incentive);
    if (commissionSales !== undefined) payroll.commissionSales = Number(commissionSales);
    if (advanceDeduction !== undefined) payroll.advanceDeduction = Number(advanceDeduction);

    // Recalculate Gross Salary, Total Deductions & Net Pay
    // Recalculate after override
    payroll.grossSalary = Math.round(
      payroll.basicSalary +
      payroll.holidayWages +
      payroll.normalOTAmount +
      payroll.doubleOTAmount +
      payroll.attendanceAllowance +
      payroll.incentive +
      payroll.commissionSales -
      payroll.noPayAmount  // noPayAmount subtracted inside gross
    );

    payroll.totalDeductions = Math.round(
      payroll.epfEmployee8 +
      payroll.loanDeductions +
      payroll.advanceDeduction +
      payroll.noPayAmount
    );

    // noPayAmount already in gross so don't subtract again here
    payroll.netPay = Math.max(
      0,
      payroll.grossSalary - payroll.epfEmployee8 - payroll.loanDeductions - payroll.advanceDeduction
    );

    await payroll.save();
    res.json({ success: true, message: "Payroll adjustments saved", data: payroll });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

