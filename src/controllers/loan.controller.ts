import { Response } from "express";
import { Loan } from "../models/Loan";
import { AuthRequest } from "../middleware/auth.middleware";

export const getEmployeeLoans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const loans = await Loan.find({ employeeId }).sort({ createdAt: -1 });
    res.json({ success: true, count: loans.length, data: loans });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, companyId, description, principalAmount, monthlyInstalment, disbursedDate } = req.body;
    if (!employeeId || !companyId || !principalAmount || !monthlyInstalment) {
      res.status(400).json({ success: false, message: "Employee ID, Company ID, principal amount, and monthly instalment are required" });
      return;
    }

    const loan = await Loan.create({
      employeeId,
      companyId,
      description: description || "Staff Loan / Advance",
      principalAmount: Number(principalAmount),
      monthlyInstalment: Number(monthlyInstalment),
      balance: Number(principalAmount),
      disbursedDate: disbursedDate ? new Date(disbursedDate) : new Date(),
      status: "active",
      repayments: [],
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLoanById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const loan = await Loan.findById(id).populate("employeeId", "name employeeNo designation");
    if (!loan) {
      res.status(404).json({ success: false, message: "Loan not found" });
      return;
    }
    res.json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLoanStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, monthlyInstalment } = req.body;

    const loan = await Loan.findById(id);
    if (!loan) {
      res.status(404).json({ success: false, message: "Loan not found" });
      return;
    }

    if (status) loan.status = status;
    if (monthlyInstalment !== undefined) loan.monthlyInstalment = Number(monthlyInstalment);

    await loan.save();
    res.json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
