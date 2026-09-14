import { Schema, model, Document, Types } from "mongoose";

export type DayType = "normal" | "sunday" | "poya" | "public_holiday";

export interface IAttendanceRecord {
  dateStr: string; // YYYY-MM-DD
  dayType: DayType;
  inTime: number | null;
  outTime: number | null;
  punches: number[];
}

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  employeeNo: string;
  month: number;
  year: number;
  records: IAttendanceRecord[];
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceRecordSchema = new Schema<IAttendanceRecord>({
  dateStr: { type: String, required: true },
  dayType: {
    type: String,
    enum: ["normal", "sunday", "poya", "public_holiday"],
    default: "normal",
  },
  inTime: { type: Number, default: null },
  outTime: { type: Number, default: null },
  punches: [{ type: Number }],
});

const attendanceSchema = new Schema<IAttendance>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    employeeNo: { type: String, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    records: [attendanceRecordSchema],
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

attendanceSchema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });

export const Attendance = model<IAttendance>("Attendance", attendanceSchema);
