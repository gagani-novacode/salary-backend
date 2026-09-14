import { Schema, model, Document, Types } from "mongoose";

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  branchLocation: string;
  address?: string;
  registrationNo?: string;
  epfRegNo?: string;
  etfRegNo?: string;
  contactEmail?: string;
  contactPhone?: string;
  workingDaysPerMonth: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    branchLocation: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    registrationNo: { type: String, default: "" },
    epfRegNo: { type: String, default: "" },
    etfRegNo: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    workingDaysPerMonth: { type: Number, default: 26 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Company = model<ICompany>("Company", companySchema);
