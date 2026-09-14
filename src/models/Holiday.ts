import { Schema, model, Document, Types } from "mongoose";

export interface IHoliday extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  name: string;
  type: "poya" | "public_holiday";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<IHoliday>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["poya", "public_holiday"], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

holidaySchema.index({ companyId: 1, date: 1 }, { unique: true });

export const Holiday = model<IHoliday>("Holiday", holidaySchema);
