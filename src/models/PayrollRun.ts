import { Schema, model, Document, Types } from "mongoose";

export interface IPayrollRun extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  month: number;
  year: number;
  
  // Employee snapshot
  employeeNo: string;
  employeeName: string;
  designation: string;
  department: string;
  
  // Day & Leave Breakdown
  entitledHolidays: number;
  usedLeavesTotal: number;
  usedLeavesThisMonth: number;
  noPayDays: number;
  weekdays: number;
  poyaDays: number;
  sundays: number;
  publicHolidays: number;
  workingDaysInMonth: number;
  
  // Earnings
  basicSalary: number;
  holidayWages: number;
  normalOTHours: number;
  normalOTAmount: number;
  doubleOTHours: number;
  doubleOTAmount: number;
  salaryForEPF: number;
  attendanceAllowance: number;
  incentive: number;
  commissionSales: number;
  grossSalary: number;
  
  // Deductions
  epfEmployee8: number;
  loanDeductions: number;
  advanceDeduction: number;
  noPayAmount: number;
  totalDeductions: number;
  
  // Employer Contributions
  epfEmployer12: number;
  etf3: number;
  
  // Final Net Pay
  netPay: number;
  
  status: "draft" | "approved" | "paid";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payrollRunSchema = new Schema<IPayrollRun>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    
    employeeNo: { type: String, required: true },
    employeeName: { type: String, required: true },
    designation: { type: String, default: "Staff" },
    department: { type: String, default: "General" },
    
    entitledHolidays: { type: Number, default: 0 },
    usedLeavesTotal: { type: Number, default: 0 },
    usedLeavesThisMonth: { type: Number, default: 0 },
    noPayDays: { type: Number, default: 0 },
    weekdays: { type: Number, default: 0 },
    poyaDays: { type: Number, default: 0 },
    sundays: { type: Number, default: 0 },
    publicHolidays: { type: Number, default: 0 },
    workingDaysInMonth: { type: Number, default: 26 },
    
    basicSalary: { type: Number, required: true },
    holidayWages: { type: Number, default: 0 },
    normalOTHours: { type: Number, default: 0 },
    normalOTAmount: { type: Number, default: 0 },
    doubleOTHours: { type: Number, default: 0 },
    doubleOTAmount: { type: Number, default: 0 },
    salaryForEPF: { type: Number, default: 0 },
    attendanceAllowance: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    commissionSales: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    
    epfEmployee8: { type: Number, default: 0 },
    loanDeductions: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    noPayAmount: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    
    epfEmployer12: { type: Number, default: 0 },
    etf3: { type: Number, default: 0 },
    
    netPay: { type: Number, required: true },
    
    status: { type: String, enum: ["draft", "approved", "paid"], default: "draft" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

payrollRunSchema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });

export const PayrollRun = model<IPayrollRun>("PayrollRun", payrollRunSchema);
