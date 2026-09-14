import { Schema, model, Document, Types } from "mongoose";

export interface ILoanRepayment {
  month: number;
  year: number;
  amountDeducted: number;
  balanceBefore: number;
  balanceAfter: number;
  payrollRunId?: Types.ObjectId;
  date: Date;
}

export interface ILoan extends Document {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  companyId: Types.ObjectId;
  description: string;
  principalAmount: number;
  disbursedDate: Date;
  monthlyInstalment: number;
  balance: number;
  status: "active" | "settled";
  repayments: ILoanRepayment[];
  createdAt: Date;
  updatedAt: Date;
}

const loanRepaymentSchema = new Schema<ILoanRepayment>({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  amountDeducted: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  payrollRunId: { type: Schema.Types.ObjectId, ref: "PayrollRun" },
  date: { type: Date, default: Date.now },
});

const loanSchema = new Schema<ILoan>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    description: { type: String, required: true, default: "Staff Loan" },
    principalAmount: { type: Number, required: true },
    disbursedDate: { type: Date, default: Date.now },
    monthlyInstalment: { type: Number, required: true },
    balance: { type: Number, required: true },
    status: { type: String, enum: ["active", "settled"], default: "active" },
    repayments: [loanRepaymentSchema],
  },
  { timestamps: true }
);

export const Loan = model<ILoan>("Loan", loanSchema);
