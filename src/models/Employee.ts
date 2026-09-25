import { Schema, model, Document, Types } from "mongoose";

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeNo: string;
  name: string;
  designation: string;
  nic: string;
  department: string;
  basicSalary: number;
  entitledHolidays: number;
  epfEligible: boolean;
  etfEligible: boolean;
  joiningDate?: Date;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeNo: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, default: "Staff" },
    nic: { type: String, trim: true },
    department: { type: String, default: "General" },
    basicSalary: { type: Number, required: true, default: 0 },
    entitledHolidays: { type: Number, default: 14 },
    epfEligible: { type: Boolean, default: true },
    etfEligible: { type: Boolean, default: true },
    joiningDate: { type: Date },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

employeeSchema.index({ companyId: 1, employeeNo: 1 }, { unique: true });

export const Employee = model<IEmployee>("Employee", employeeSchema);
